import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type { DirectoryEntry, NextcloudCredentialData, OcsEnvelope, ParsedShare } from './FilesInterface';

/** n8n's IHttpRequestMethods omits WebDAV verbs like PROPFIND, MKCOL, MOVE, and COPY. */
export type NextcloudHttpMethod = IHttpRequestMethods | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY';

const FILES_ROOT_MARKER = '/remote.php/dav/files/';

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

function parseTagValue(xml: string, tagName: string): string | undefined {
	const match = xml.match(new RegExp(`<[^>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, 'i'));
	return match?.[1]?.trim();
}

function decodeDavHref(href: string): string {
	try {
		return decodeURIComponent(href);
	} catch {
		return href;
	}
}

/** Normalize a user-facing files path to a leading-slash form without trailing slash (root is `/`). */
export function normalizeFilesPath(path: string): string {
	const trimmed = path.trim();
	if (!trimmed || trimmed === '/') return '/';
	const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
	const normalized = withLeading.replace(/\/+$/, '') || '/';
	if (normalized === '/') return '/';

	for (const segment of normalized.split('/').filter(Boolean)) {
		if (segment === '.' || segment === '..') {
			throw new Error(`Invalid path: "${path}" contains "." or ".." segments`);
		}
	}

	return normalized;
}

/**
 * Build the WebDAV files URL for a path relative to the user's files root.
 * Each path segment is individually encoded; slashes are preserved.
 */
export function buildFilesUrl(baseUrl: string, username: string, path: string): string {
	const base = normalizeBaseUrl(baseUrl);
	const user = encodeURIComponent(username);
	const normalizedPath = normalizeFilesPath(path);
	if (normalizedPath === '/') {
		return `${base}${FILES_ROOT_MARKER}${user}`;
	}
	const relative = normalizedPath.replace(/^\/+/, '');
	const encodedPath = relative.split('/').map((segment) => encodeURIComponent(segment)).join('/');
	return `${base}${FILES_ROOT_MARKER}${user}/${encodedPath}`;
}

/** Absolute Destination header value for MOVE/COPY (full WebDAV URL, per-segment encoded). */
export function buildDestinationHeader(
	baseUrl: string,
	username: string,
	destinationPath: string,
): string {
	return buildFilesUrl(baseUrl, username, destinationPath);
}

/** Overwrite header value for MOVE/COPY (`T` = allow overwrite, `F` = fail if exists). */
export function buildOverwriteHeader(overwrite: boolean): string {
	return overwrite ? 'T' : 'F';
}

/** Extract the user-relative path from a DAV href under `/remote.php/dav/files/{username}/`. */
export function relativePathFromFilesHref(href: string, username: string): string | undefined {
	const decoded = decodeDavHref(href).trim();
	const lower = decoded.toLowerCase();
	const marker = `${FILES_ROOT_MARKER}${username}/`.toLowerCase();
	const markerIndex = lower.indexOf(marker);
	if (markerIndex === -1) {
		const genericMarker = lower.indexOf(FILES_ROOT_MARKER.toLowerCase());
		if (genericMarker === -1) return undefined;
		const tail = decoded.slice(genericMarker + FILES_ROOT_MARKER.length);
		const segments = tail.split('/').filter(Boolean);
		if (segments.length < 2) return '/';
		const relative = segments
			.slice(1)
			.map((segment) => decodeURIComponent(segment))
			.join('/');
		return relative ? `/${relative}` : '/';
	}
	const relative = decoded
		.slice(markerIndex + marker.length)
		.replace(/\/+$/, '')
		.split('/')
		.map((segment) => decodeURIComponent(segment))
		.join('/');
	return relative ? `/${relative}` : '/';
}

function basenameFromPath(path: string): string {
	const normalized = normalizeFilesPath(path);
	if (normalized === '/') return '/';
	const segments = normalized.split('/').filter(Boolean);
	return segments[segments.length - 1] ?? '/';
}

function isCollectionBlock(block: string): boolean {
	return /<[^>]*:?collection\b/i.test(block);
}

/**
 * Parse a WebDAV PROPFIND multistatus into directory entries.
 * `parentPath` is the normalized path of the listed directory (used to skip the self response).
 */
export function parseDirectoryListingFromMultistatus(
	xml: string,
	username: string,
	parentPath = '/',
): DirectoryEntry[] {
	const responseBlocks = xml.split(/<[^>]*:?response>/i).slice(1);
	const normalizedParent = normalizeFilesPath(parentPath);
	const entries: DirectoryEntry[] = [];

	for (const block of responseBlocks) {
		const href = parseTagValue(block, 'href');
		if (!href) continue;

		const path = relativePathFromFilesHref(href, username);
		if (path === undefined) continue;
		if (normalizeFilesPath(path) === normalizedParent) continue;

		const isFolder = isCollectionBlock(block);
		const sizeRaw = parseTagValue(block, 'getcontentlength');
		const parsedSize = sizeRaw !== undefined ? Number(sizeRaw) : undefined;

		entries.push({
			href,
			basename: basenameFromPath(path),
			path,
			isFolder,
			size: parsedSize !== undefined && Number.isFinite(parsedSize) ? parsedSize : undefined,
			lastModified: parseTagValue(block, 'getlastmodified'),
			contentType: parseTagValue(block, 'getcontenttype'),
			etag: parseTagValue(block, 'getetag'),
		});
	}

	return entries;
}

export async function getCredentials(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<NextcloudCredentialData> {
	const credentials = (await context.getCredentials('nextcloudApi')) as NextcloudCredentialData;

	return {
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		username: credentials.username,
		appPassword: credentials.appPassword,
	};
}

export async function nextcloudRequest(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	method: NextcloudHttpMethod,
	url: string,
	body?: string | Buffer | IDataObject,
	headers?: IDataObject,
	options?: IDataObject,
) {
	return await context.helpers.httpRequestWithAuthentication.call(context, 'nextcloudApi', {
		method: method as IHttpRequestMethods,
		url,
		body,
		headers: {
			...(headers ?? {}),
		},
		returnFullResponse: false,
		...(options ?? {}),
	});
}

const DIRECTORY_PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
	<d:prop>
		<d:getetag />
		<d:getcontenttype />
		<d:getcontentlength />
		<d:getlastmodified />
		<d:resourcetype />
	</d:prop>
</d:propfind>`;

export async function loadDirectoryListing(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	credentials: NextcloudCredentialData,
	directoryPath: string,
): Promise<DirectoryEntry[]> {
	const normalizedDirectory = normalizeFilesPath(directoryPath);
	const directoryUrl = buildFilesUrl(credentials.baseUrl, credentials.username, normalizedDirectory);
	const response = await nextcloudRequest(context, 'PROPFIND', directoryUrl, DIRECTORY_PROPFIND_BODY, {
		Depth: '1',
		'Content-Type': 'application/xml; charset=utf-8',
		Accept: 'application/xml',
	});

	const xml = typeof response === 'string' ? response : JSON.stringify(response);
	return parseDirectoryListingFromMultistatus(xml, credentials.username, normalizedDirectory);
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

export function matchesPathListFilter(path: string, basename: string, filter?: string): boolean {
	const trimmed = filter?.trim();
	if (!trimmed) return true;

	const lower = trimmed.toLowerCase();
	return path.toLowerCase().includes(lower) || basename.toLowerCase().includes(lower);
}

export function directoryEntryToListOption(entry: DirectoryEntry): { name: string; value: string } {
	const prefix = entry.isFolder ? '📁 ' : '📄 ';
	const displayPath = entry.path === '/' ? '/' : entry.path.replace(/^\//, '');
	return {
		name: `${prefix}${displayPath}`,
		value: entry.path,
	};
}

export function sortDirectoryEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
	return [...entries].sort((left, right) => {
		if (left.isFolder !== right.isFolder) {
			return left.isFolder ? -1 : 1;
		}

		return left.path.localeCompare(right.path);
	});
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

export async function collectPathEntriesRecursive(
	context: ILoadOptionsFunctions | IExecuteFunctions,
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

export function fileNameFromPath(path: string): string {
	return basenameFromPath(path);
}

export function joinPath(parent: string, child: string): string {
	const normalizedParent = normalizeFilesPath(parent);
	const trimmedChild = child.trim().replace(/^\/+/, '');
	if (normalizedParent === '/') return `/${trimmedChild}`;
	return `${normalizedParent}/${trimmedChild}`;
}

export function resolveUploadPath(
	targetPath: string,
	fileName?: string,
): string {
	const normalized = normalizeFilesPath(targetPath);
	if (!fileName?.trim()) return normalized;
	if (normalized === '/') return `/${fileName.trim()}`;
	if (normalized.endsWith(`/${fileName.trim()}`) || normalized.split('/').pop() === fileName.trim()) {
		return normalized;
	}
	return joinPath(normalized, fileName.trim());
}

export function contentTypeFromFileName(fileName: string): string {
	const lower = fileName.toLowerCase();
	if (lower.endsWith('.txt')) return 'text/plain';
	if (lower.endsWith('.json')) return 'application/json';
	if (lower.endsWith('.pdf')) return 'application/pdf';
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
	if (lower.endsWith('.csv')) return 'text/csv';
	return 'application/octet-stream';
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

/** Parse a share ID from node parameters or expressions such as `{{ $json.id }}`. */
export function parseShareId(value: unknown): number {
	if (value === undefined || value === null || value === '') {
		throw new Error('Share ID is required');
	}

	const parsed = typeof value === 'number' ? value : Number(String(value).trim());
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error('Share ID must be a positive number');
	}

	return parsed;
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

interface OcsPasswordValidationData {
	passed?: boolean;
	reason?: string;
}

/** Parse the password_policy validate response; returns an error message when validation fails. */
export function parseSharePasswordValidationResult(response: unknown): string | undefined {
	const envelope = response as OcsEnvelope<OcsPasswordValidationData>;
	const statusCode = envelope?.ocs?.meta?.statuscode;
	const message = envelope?.ocs?.meta?.message;

	if (statusCode !== undefined && statusCode !== 100 && statusCode !== 200) {
		return message?.trim() || `Password policy request failed with status ${statusCode}`;
	}

	if (envelope?.ocs?.data?.passed === false) {
		return (
			envelope.ocs.data.reason?.trim() ||
			'Password does not meet the server password policy for public link shares'
		);
	}

	return undefined;
}

/**
 * Validate a share password against the Nextcloud password_policy app (sharing context).
 * Returns an error message when validation fails, or undefined when the password is accepted,
 * the password_policy app is unavailable, or the validate request cannot be completed.
 */
export async function validateSharePassword(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	password: string,
): Promise<string | undefined> {
	const trimmed = password.trim();
	if (!trimmed) return undefined;

	const credentials = await getCredentials(context);
	const url = `${credentials.baseUrl}/ocs/v2.php/apps/password_policy/api/v1/validate?format=json`;

	try {
		const response = await nextcloudRequest(
			context,
			'POST',
			url,
			{ password: trimmed, context: 'sharing' },
			{
				'OCS-APIRequest': 'true',
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		);
		return parseSharePasswordValidationResult(response);
	} catch {
		return undefined;
	}
}

/** OR permission labels into the Nextcloud OCS permissions bitmask. */
export function permissionsToBitmask(permissions: string[]): number {
	return permissions.reduce(
		(mask, permission) => mask | (PERMISSION_BITMASK[permission.toLowerCase()] ?? 0),
		0,
	);
}

function asString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	const text = String(value).trim();
	return text || undefined;
}

function asNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'boolean') return value;
	const normalized = String(value).toLowerCase();
	if (normalized === 'true' || normalized === '1') return true;
	if (normalized === 'false' || normalized === '0') return false;
	return undefined;
}

/** Normalize OCS share payloads that may be a single object or a one-element array (GET by ID). */
export function normalizeOcsSharePayload(data: unknown): IDataObject {
	if (Array.isArray(data)) {
		if (data.length === 0) {
			throw new Error('Invalid OCS share payload');
		}
		const first = data[0];
		if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
			return first as IDataObject;
		}
		throw new Error('Invalid OCS share payload');
	}

	if (typeof data === 'object' && data !== null) {
		return data as IDataObject;
	}

	throw new Error('Invalid OCS share payload');
}

/** Normalize a single OCS share payload into a stable workflow shape. */
export function parseShare(data: unknown): ParsedShare {
	const share = normalizeOcsSharePayload(data);
	const id = asNumber(share.id);
	const shareType = asNumber(share.share_type ?? share.shareType);
	const path = asString(share.path) ?? asString(share.file_target);

	if (id === undefined || shareType === undefined || !path) {
		throw new Error('Invalid OCS share payload');
	}

	const permissions = asNumber(share.permissions) ?? 0;

	return {
		id,
		shareType,
		path,
		permissions,
		shareWith: asString(share.share_with ?? share.shareWith),
		url: asString(share.url),
		token: asString(share.token),
		expiration: asString(share.expiration ?? share.expire_date ?? share.expireDate),
		note: asString(share.note),
		publicUpload: asBoolean(share.public_upload ?? share.publicUpload),
		uidOwner: asString(share.uid_owner ?? share.uidOwner),
		displaynameOwner: asString(share.displayname_owner ?? share.displaynameOwner),
		itemType: asString(share.item_type ?? share.itemType),
		mimetype: asString(share.mimetype),
	};
}

function buildOcsQueryString(qs?: IDataObject): string {
	const params = new URLSearchParams({ format: 'json' });
	if (qs) {
		for (const [key, value] of Object.entries(qs)) {
			if (value !== undefined && value !== null && value !== '') {
				params.set(key, String(value));
			}
		}
	}
	return params.toString();
}

function buildOcsFormBody(body?: IDataObject): string | undefined {
	if (!body) return undefined;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(body)) {
		if (value === undefined || value === null || value === '') continue;
		params.set(key, String(value));
	}
	return params.toString();
}

export function unwrapOcsResponse(response: unknown): unknown {
	const envelope = response as OcsEnvelope;
	const statusCode = envelope?.ocs?.meta?.statuscode;
	const message = envelope?.ocs?.meta?.message;

	if (statusCode === undefined) {
		throw new Error('Invalid OCS response envelope');
	}

	if (statusCode !== 100 && statusCode !== 200) {
		const ocsError = new Error(
			message?.trim() || `OCS request failed with status ${statusCode}`,
		) as Error & { statusCode: number };
		ocsError.statusCode = statusCode;
		throw ocsError;
	}

	return envelope.ocs.data;
}

/**
 * Authenticated OCS request against the files_sharing API.
 * Forces JSON output and unwraps the `ocs.data` envelope.
 */
export async function ocsRequest(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	method: NextcloudHttpMethod,
	apiPath: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const credentials = await getCredentials(context);
	const queryString = buildOcsQueryString(qs);
	const url = `${credentials.baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/${apiPath}?${queryString}`;
	const formBody = buildOcsFormBody(body);
	const headers: IDataObject = {
		'OCS-APIRequest': 'true',
		Accept: 'application/json',
	};

	if (formBody !== undefined) {
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}

	const response = await nextcloudRequest(
		context,
		method,
		url,
		formBody,
		headers,
	);

	return unwrapOcsResponse(response);
}
