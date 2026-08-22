import type { IDataObject } from 'n8n-workflow';

import type { FilesClient } from './files.client';
import { FilesClient as FilesClientImpl } from './files.client';
import type { DirectoryEntry } from './FilesInterface';
import {
	listFolder,
	parseDirectoryListingFromMultistatus,
} from './repositories/FilesFolder.repository';
import {
	buildOcsFormBody,
	normalizeOcsSharePayload,
	OcsRequestError,
	parseShare,
	parseSharePasswordValidationResult,
	unwrapOcsResponse,
	validateSharePasswordWithClient,
} from './repositories/FilesShare.repository';
import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	contentTypeFromFileName,
	directoryEntryToListOption,
	fileNameFromPath,
	joinPath,
	matchesPathListFilter,
	normalizeFilesPath,
	parentPath,
	relativePathFromFilesHref,
	resolveUploadPath,
	sortDirectoryEntries,
} from './shared/filesPaths';
import {
	parseNextcloudCredentials,
	type NextcloudCredentialData,
} from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import { unwrapResult } from '../shared/apiResult';

export type { NextcloudCredentialData };
export type { NextcloudHttpMethod } from '../shared/assertHttpMethodIsValid';

export {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	contentTypeFromFileName,
	directoryEntryToListOption,
	fileNameFromPath,
	joinPath,
	matchesPathListFilter,
	normalizeFilesPath,
	parentPath,
	relativePathFromFilesHref,
	resolveUploadPath,
	sortDirectoryEntries,
};

export {
	buildOcsFormBody,
	normalizeOcsSharePayload,
	OcsRequestError,
	parseDirectoryListingFromMultistatus,
	parseShare,
	parseSharePasswordValidationResult,
	unwrapOcsResponse,
};

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export async function getCredentials(
	context: NextcloudRequestContext,
): Promise<NextcloudCredentialData> {
	const credentials = parseNextcloudCredentials(await context.getCredentials('nextcloudApi'));

	return {
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		username: credentials.username,
		appPassword: credentials.appPassword,
	};
}

/** Build a FilesClient that sends WebDAV/OCS calls through n8n's authenticated HTTP helper. */
export async function createFilesClient(context: NextcloudRequestContext): Promise<FilesClient> {
	return await FilesClientImpl.fromN8nContext(context);
}

/**
 * List a directory via WebDAV PROPFIND.
 * Used by Files resources, listSearch, and NextcloudFilesTrigger until Phase 4.
 */
export async function loadDirectoryListing(
	context: NextcloudRequestContext,
	_credentials: NextcloudCredentialData,
	directoryPath: string,
): Promise<DirectoryEntry[]> {
	return unwrapResult(
		await listFolder(await createFilesClient(context), { directoryPath }),
	);
}

export const LIST_SEARCH_PAGE_SIZE = 50;
export const LIST_SEARCH_MAX_DEPTH = 15;
export const LIST_SEARCH_MAX_ENTRIES = 1000;

export interface PathListSearchScope {
	includeFiles: boolean;
	includeFolders: boolean;
}

export function resolvePathListSearchScope(
	resource?: string,
	operation?: string,
): PathListSearchScope {
	if (resource === 'file' && ['download', 'delete', 'move', 'copy'].includes(operation ?? '')) {
		return { includeFiles: true, includeFolders: false };
	}

	if (
		resource === 'folder' &&
		['create', 'delete', 'move', 'copy'].includes(operation ?? '')
	) {
		return { includeFiles: false, includeFolders: true };
	}

	return { includeFiles: true, includeFolders: true };
}

export function paginatePathListOptions<T extends { name: string; value: string }>(
	entries: T[],
	offset: number,
	pageSize = LIST_SEARCH_PAGE_SIZE,
): { results: T[]; paginationToken?: string } {
	if (offset >= entries.length) {
		return { results: [] };
	}

	const results = entries.slice(offset, offset + pageSize);
	const nextOffset = offset + results.length;
	if (nextOffset < entries.length) {
		return { results, paginationToken: String(nextOffset) };
	}

	return { results };
}

const PATH_LIST_SEARCH_CACHE = new Map<string, Array<{ name: string; value: string }>>();
const PATH_LIST_SEARCH_CACHE_MAX = 32;

export function buildPathListSearchCacheKey(
	credentials: NextcloudCredentialData,
	resource?: string,
	operation?: string,
	filter?: string,
): string {
	return [
		credentials.baseUrl,
		credentials.username,
		resource ?? '',
		operation ?? '',
		filter?.trim() ?? '',
	].join('\0');
}

export function getCachedPathListOptions(
	cacheKey: string,
): Array<{ name: string; value: string }> | undefined {
	return PATH_LIST_SEARCH_CACHE.get(cacheKey);
}

export function setCachedPathListOptions(
	cacheKey: string,
	options: Array<{ name: string; value: string }>,
): void {
	if (!PATH_LIST_SEARCH_CACHE.has(cacheKey) && PATH_LIST_SEARCH_CACHE.size >= PATH_LIST_SEARCH_CACHE_MAX) {
		const oldestKey = PATH_LIST_SEARCH_CACHE.keys().next().value;
		if (oldestKey) PATH_LIST_SEARCH_CACHE.delete(oldestKey);
	}

	PATH_LIST_SEARCH_CACHE.set(cacheKey, options);
}

export function clearPathListSearchCache(): void {
	PATH_LIST_SEARCH_CACHE.clear();
}

export async function collectPathEntriesRecursive(
	context: NextcloudRequestContext,
	credentials: NextcloudCredentialData,
	options: PathListSearchScope & {
		filter?: string;
		maxDepth?: number;
		maxEntries?: number;
	},
): Promise<DirectoryEntry[]> {
	const maxDepth = options.maxDepth ?? LIST_SEARCH_MAX_DEPTH;
	const maxEntries = options.maxEntries ?? LIST_SEARCH_MAX_ENTRIES;
	const filter = options.filter?.trim();
	const results: DirectoryEntry[] = [];
	const queue: Array<{ path: string; depth: number }> = [{ path: '/', depth: 0 }];

	while (queue.length > 0 && results.length < maxEntries) {
		const current = queue.shift();
		if (!current) break;

		const entries = await loadDirectoryListing(context, credentials, current.path);

		for (const entry of entries) {
			if (results.length >= maxEntries) break;

			const includeEntry =
				(entry.isFolder && options.includeFolders) ||
				(!entry.isFolder && options.includeFiles);
			const matchesFilter = matchesPathListFilter(entry.path, entry.basename, filter);

			if (includeEntry && matchesFilter) {
				results.push(entry);
			}

			if (entry.isFolder && current.depth + 1 < maxDepth) {
				queue.push({ path: entry.path, depth: current.depth + 1 });
			}
		}
	}

	return sortDirectoryEntries(results);
}

const PERMISSION_BITMASK: Record<string, number> = {
	read: 1,
	update: 2,
	create: 4,
	delete: 8,
	share: 16,
};

export const OCS_SHARE_TYPE_USER = 0;
export const OCS_SHARE_TYPE_GROUP = 1;
export const OCS_SHARE_TYPE_PUBLIC = 3;
export const OCS_SHARE_TYPE_EMAIL = 4;

export function sanitizeSharePermissionLabels(
	permissions: string[],
	shareType: number,
): string[] {
	const normalized = permissions
		.map((permission) => permission.toLowerCase())
		.filter((permission) => PERMISSION_BITMASK[permission] !== undefined);

	if (shareType === OCS_SHARE_TYPE_PUBLIC) {
		return normalized.filter((permission) => permission === 'read' || permission === 'create');
	}

	return normalized;
}

/** Resolve share permission labels to the OCS bitmask, sanitizing by share type. */
export function buildSharePermissionsBitmask(
	permissionLabels: string[],
	shareType: number,
): number {
	const sanitized = sanitizeSharePermissionLabels(permissionLabels, shareType);

	if (sanitized.length === 0) {
		if (permissionLabels.length > 0) {
			throw new Error(
				'No valid permissions remain for this share type. Public link shares support Read (and Create for folder uploads) only.',
			);
		}

		if (shareType === OCS_SHARE_TYPE_PUBLIC) {
			return permissionsToBitmask(['read']);
		}

		throw new Error(
			'Select at least one permission to apply. Public link shares support Read (and Create for folder uploads) only.',
		);
	}

	return permissionsToBitmask(sanitized);
}

export const SHARE_UPDATE_FIELD_PERMISSIONS = 'permissions';
export const SHARE_UPDATE_FIELD_PASSWORD = 'password';
export const SHARE_UPDATE_FIELD_EXPIRE_DATE = 'expireDate';
export const SHARE_UPDATE_FIELD_PUBLIC_UPLOAD = 'publicUpload';

/** Build the OCS PUT body for share updates — only includes fields listed in fieldsToUpdate. */
export function buildShareUpdateBody(options: {
	fieldsToUpdate: string[];
	permissions?: string[];
	password?: string;
	expireDate?: string;
	publicUpload?: boolean;
	shareType?: number;
}): IDataObject {
	const fieldsToUpdate = new Set(options.fieldsToUpdate);
	if (fieldsToUpdate.size === 0) {
		throw new Error(
			'Select at least one field to update (permissions, password, expire date, or public upload)',
		);
	}

	const body: IDataObject = {};

	if (fieldsToUpdate.has(SHARE_UPDATE_FIELD_PERMISSIONS)) {
		const permissionLabels = options.permissions ?? [];
		body.permissions =
			options.shareType === undefined
				? permissionsToBitmask(permissionLabels)
				: buildSharePermissionsBitmask(permissionLabels, options.shareType);
	}

	if (fieldsToUpdate.has(SHARE_UPDATE_FIELD_PASSWORD)) {
		body.password = options.password?.trim() ?? '';
	}

	if (fieldsToUpdate.has(SHARE_UPDATE_FIELD_EXPIRE_DATE)) {
		body.expireDate = options.expireDate?.trim() ?? '';
	}

	if (fieldsToUpdate.has(SHARE_UPDATE_FIELD_PUBLIC_UPLOAD)) {
		body.publicUpload = options.publicUpload ? 'true' : 'false';
	}

	return body;
}

/**
 * Validate a share password against the Nextcloud password_policy app (sharing context).
 * Returns an error message when validation fails or the policy endpoint is unreachable
 * (transport / 5xx / unknown). Returns undefined when the password is accepted, or when
 * the password_policy app appears missing (HTTP 404/405/501 — fail open).
 */
export async function validateSharePassword(
	context: NextcloudRequestContext,
	password: string,
): Promise<string | undefined> {
	return await validateSharePasswordWithClient(await createFilesClient(context), password);
}

/** OR permission labels into the Nextcloud OCS permissions bitmask. */
export function permissionsToBitmask(permissions: string[]): number {
	return permissions.reduce(
		(mask, permission) => mask | (PERMISSION_BITMASK[permission.toLowerCase()] ?? 0),
		0,
	);
}
