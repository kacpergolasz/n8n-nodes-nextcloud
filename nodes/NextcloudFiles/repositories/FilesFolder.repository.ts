/**
 * Repository for Nextcloud Files folders (WebDAV).
 *
 * Reference: nodes/NextcloudFiles/context/api/documentation/openapi.md
 */
import { z } from 'zod';

import type { DirectoryEntry } from '../FilesInterface';
import type { FilesClient } from '../files.client';
import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	fileNameFromPath,
	normalizeFilesPath,
	relativePathFromFilesHref,
} from '../shared/filesPaths';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

export const directoryEntrySchema = z.object({
	href: z.string(),
	basename: z.string(),
	path: z.string(),
	isFolder: z.boolean(),
	size: z.number().optional(),
	lastModified: z.string().optional(),
	contentType: z.string().optional(),
	etag: z.string().optional(),
});

export const directoryEntriesSchema = z.array(directoryEntrySchema);

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

function parseTagValue(xml: string, tagName: string): string | undefined {
	const match = xml.match(new RegExp(`<[^>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, 'i'));
	return match?.[1]?.trim();
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
			basename: fileNameFromPath(path),
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

export type ListFolderOptions = {
	directoryPath: string;
};

export async function listFolder(
	client: FilesClient,
	options: ListFolderOptions,
): Promise<Maybe<DirectoryEntry[]>> {
	const normalizedDirectory = normalizeFilesPath(options.directoryPath);
	const directoryUrl = buildFilesUrl(client.baseUrl, client.username, normalizedDirectory);
	const result = await client.propfind(directoryUrl, DIRECTORY_PROPFIND_BODY, {
		Depth: '1',
		'Content-Type': 'application/xml; charset=utf-8',
		Accept: 'application/xml',
	});
	if (!result.success) {
		return result;
	}

	const xml =
		typeof result.response === 'string'
			? result.response
			: result.response === undefined || result.response === null
				? ''
				: JSON.stringify(result.response);

	try {
		const entries = parseDirectoryListingFromMultistatus(
			xml,
			client.username,
			normalizedDirectory,
		);
		return parseWith({ success: true, response: entries }, directoryEntriesSchema);
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

export type CreateFolderOptions = {
	folderPath: string;
};

export async function createFolder(
	client: FilesClient,
	options: CreateFolderOptions,
): Promise<Maybe<null>> {
	const folderPath = normalizeFilesPath(options.folderPath);
	const folderUrl = buildFilesUrl(client.baseUrl, client.username, folderPath);
	return parseEmpty(await client.mkcol(folderUrl));
}

export type DeleteFolderOptions = {
	folderPath: string;
};

export async function deleteFolder(
	client: FilesClient,
	options: DeleteFolderOptions,
): Promise<Maybe<null>> {
	const folderPath = normalizeFilesPath(options.folderPath);
	const folderUrl = buildFilesUrl(client.baseUrl, client.username, folderPath);
	return parseEmpty(await client.delete(folderUrl, undefined, undefined, { json: false }));
}

export type TransferFolderOptions = {
	sourcePath: string;
	destinationPath: string;
	overwrite: boolean;
};

export async function moveFolder(
	client: FilesClient,
	options: TransferFolderOptions,
): Promise<Maybe<null>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const destinationPath = normalizeFilesPath(options.destinationPath);
	const sourceUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return parseEmpty(
		await client.move(sourceUrl, {
			Destination: buildDestinationHeader(client.baseUrl, client.username, destinationPath),
			Overwrite: buildOverwriteHeader(options.overwrite),
		}),
	);
}

export async function copyFolder(
	client: FilesClient,
	options: TransferFolderOptions,
): Promise<Maybe<null>> {
	const sourcePath = normalizeFilesPath(options.sourcePath);
	const destinationPath = normalizeFilesPath(options.destinationPath);
	const sourceUrl = buildFilesUrl(client.baseUrl, client.username, sourcePath);
	return parseEmpty(
		await client.copy(sourceUrl, {
			Destination: buildDestinationHeader(client.baseUrl, client.username, destinationPath),
			Overwrite: buildOverwriteHeader(options.overwrite),
		}),
	);
}
