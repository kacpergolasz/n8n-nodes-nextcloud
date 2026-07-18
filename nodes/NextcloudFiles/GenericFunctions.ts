import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type { DirectoryEntry, NextcloudCredentialData } from './FilesInterface';

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
	return withLeading.replace(/\/+$/, '') || '/';
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

export function directoryEntryToListOption(entry: DirectoryEntry): { name: string; value: string } {
	const prefix = entry.isFolder ? '📁 ' : '📄 ';
	return {
		name: `${prefix}${entry.basename}`,
		value: entry.path,
	};
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
