import type { DirectoryEntry } from '../FilesInterface';

const FILES_ROOT_MARKER = '/remote.php/dav/files/';

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
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

export function fileNameFromPath(path: string): string {
	const normalized = normalizeFilesPath(path);
	if (normalized === '/') return '/';
	const segments = normalized.split('/').filter(Boolean);
	return segments[segments.length - 1] ?? '/';
}

export function parentPath(path: string): string {
	const normalized = normalizeFilesPath(path);
	if (normalized === '/') return '/';

	const segments = normalized.split('/').filter(Boolean);
	segments.pop();
	return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function pathBasenameLooksLikeFile(path: string): boolean {
	const basename = fileNameFromPath(path);
	return /^[^./][^/]*\.[^/]+$/.test(basename);
}

export function joinPath(parent: string, child: string): string {
	const normalizedParent = normalizeFilesPath(parent);
	const trimmedChild = child.trim().replace(/^\/+/, '');
	if (normalizedParent === '/') return `/${trimmedChild}`;
	return `${normalizedParent}/${trimmedChild}`;
}

export function resolveUploadPath(targetPath: string, fileName?: string): string {
	const normalized = normalizeFilesPath(targetPath);
	const trimmedFileName = fileName?.trim();
	if (!trimmedFileName) return normalized;
	if (normalized === '/') return `/${trimmedFileName}`;

	const basename = fileNameFromPath(normalized);
	if (basename === trimmedFileName || normalized.endsWith(`/${trimmedFileName}`)) {
		return normalized;
	}

	if (pathBasenameLooksLikeFile(normalized)) {
		return joinPath(parentPath(normalized), trimmedFileName);
	}

	return joinPath(normalized, trimmedFileName);
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

export function matchesPathListFilter(path: string, basename: string, filter?: string): boolean {
	const trimmed = filter?.trim();
	if (!trimmed) return true;

	const lower = trimmed.toLowerCase();
	return path.toLowerCase().includes(lower) || basename.toLowerCase().includes(lower);
}
