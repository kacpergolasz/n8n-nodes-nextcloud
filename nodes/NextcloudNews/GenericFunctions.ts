import { createHash } from 'node:crypto';

import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type {
	NewsFeed,
	NewsFeedsResponse,
	NewsFolder,
	NewsFoldersResponse,
	NewsItem,
	NewsItemsResponse,
	NewsPickerOption,
	NextcloudCredentialData,
} from './NewsInterface';

export type NewsRequestEncoding =
	| 'json'
	| 'arraybuffer'
	| 'blob'
	| 'document'
	| 'text'
	| 'stream';

export type NewsRequestOptions = {
	body?: IDataObject;
	qs?: IDataObject;
	/** When false, skip JSON parse (favicon / binary). Default true. */
	json?: boolean;
	encoding?: NewsRequestEncoding;
	headers?: IDataObject;
};

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export function newsApiBase(baseUrl: string): string {
	return `${normalizeBaseUrl(baseUrl)}/index.php/apps/news/api/v1-3`;
}

export function buildFoldersUrl(baseUrl: string): string {
	return `${newsApiBase(baseUrl)}/folders`;
}

export function buildFolderUrl(baseUrl: string, folderId: string | number): string {
	return `${newsApiBase(baseUrl)}/folders/${folderId}`;
}

export function buildFeedsUrl(baseUrl: string): string {
	return `${newsApiBase(baseUrl)}/feeds`;
}

export function buildFeedUrl(baseUrl: string, feedId: string | number): string {
	return `${newsApiBase(baseUrl)}/feeds/${feedId}`;
}

export function buildFeedMoveUrl(baseUrl: string, feedId: string | number): string {
	return `${newsApiBase(baseUrl)}/feeds/${feedId}/move`;
}

export function buildFeedRenameUrl(baseUrl: string, feedId: string | number): string {
	return `${newsApiBase(baseUrl)}/feeds/${feedId}/rename`;
}

export function buildFeedReadUrl(baseUrl: string, feedId: string | number): string {
	return `${newsApiBase(baseUrl)}/feeds/${feedId}/read`;
}

export function buildFaviconUrl(baseUrl: string, feedUrlHashValue: string): string {
	return `${newsApiBase(baseUrl)}/favicon/${feedUrlHashValue}`;
}

export function buildItemActionUrl(
	baseUrl: string,
	itemId: string | number,
	action: 'read' | 'unread' | 'star' | 'unstar',
): string {
	return `${newsApiBase(baseUrl)}/items/${itemId}/${action}`;
}

export function buildItemsBulkActionUrl(
	baseUrl: string,
	action: 'read' | 'unread' | 'star' | 'unstar',
): string {
	return `${newsApiBase(baseUrl)}/items/${action}/multiple`;
}

/** MD5 hex digest of the feed URL — News favicon route key. */
export function feedUrlHash(feedUrl: string): string {
	return createHash('md5').update(feedUrl, 'utf8').digest('hex');
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

export async function newsRequest(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	options: NewsRequestOptions = {},
) {
	const credentials = await getCredentials(context);
	const url = path.startsWith('http') ? path : `${newsApiBase(credentials.baseUrl)}${path}`;
	const json = options.json !== false;

	return await context.helpers.httpRequestWithAuthentication.call(context, 'nextcloudApi', {
		method,
		url,
		body: options.body,
		qs: options.qs,
		json,
		encoding: options.encoding,
		headers: {
			Accept: json ? 'application/json' : '*/*',
			...(json ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers ?? {}),
		},
	});
}

export function unwrapFolders(response: unknown): NewsFolder[] {
	if (Array.isArray(response)) {
		return response as NewsFolder[];
	}
	const wrapped = response as NewsFoldersResponse | null | undefined;
	return Array.isArray(wrapped?.folders) ? wrapped.folders : [];
}

export function unwrapFeeds(response: unknown): NewsFeed[] {
	if (Array.isArray(response)) {
		return response as NewsFeed[];
	}
	const wrapped = response as NewsFeedsResponse | null | undefined;
	return Array.isArray(wrapped?.feeds) ? wrapped.feeds : [];
}

export function unwrapItems(response: unknown): NewsItem[] {
	if (Array.isArray(response)) {
		return response as NewsItem[];
	}
	const wrapped = response as NewsItemsResponse | null | undefined;
	return Array.isArray(wrapped?.items) ? wrapped.items : [];
}

/** Prefer a single created entity; fall back to first list entry. */
export function firstFolder(response: unknown): NewsFolder | undefined {
	if (response && typeof response === 'object' && 'id' in response && 'name' in response) {
		return response as NewsFolder;
	}
	return unwrapFolders(response)[0];
}

export function firstFeed(response: unknown): NewsFeed | undefined {
	if (response && typeof response === 'object' && 'id' in response && 'url' in response) {
		return response as NewsFeed;
	}
	return unwrapFeeds(response)[0];
}

export async function loadFolders(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<NewsPickerOption[]> {
	const folders = unwrapFolders(await newsRequest(context, 'GET', '/folders'));

	return folders.map((folder) => ({
		name: folder.name,
		value: String(folder.id),
	}));
}

export async function loadFeeds(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	folderId?: string,
): Promise<NewsPickerOption[]> {
	let feeds = unwrapFeeds(await newsRequest(context, 'GET', '/feeds'));

	if (folderId !== undefined && folderId !== '') {
		feeds = feeds.filter((feed) => String(feed.folderId ?? '') === folderId);
	}

	return feeds.map((feed) => ({
		name: feed.title || feed.url || String(feed.id),
		value: String(feed.id),
	}));
}

export async function findFeedById(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	feedId: string,
): Promise<NewsFeed | undefined> {
	const feeds = unwrapFeeds(await newsRequest(context, 'GET', '/feeds'));
	return feeds.find((feed) => String(feed.id) === feedId);
}

function coerceResourceId(input: unknown, resourceLabel: string): string {
	if (input === undefined || input === null || input === '') {
		throw new Error(`${resourceLabel} id is empty.`);
	}
	const trimmed = String(input).trim();
	if (!trimmed) {
		throw new Error(`${resourceLabel} id is empty.`);
	}
	return trimmed;
}

export function resolveFolderId(folderInput: string | number): string {
	return coerceResourceId(folderInput, 'Folder');
}

export function resolveFeedId(feedInput: string | number): string {
	return coerceResourceId(feedInput, 'Feed');
}

export function resolveItemId(itemInput: string | number): string {
	return coerceResourceId(itemInput, 'Item');
}

/** Parse comma/space-separated or JSON-array item ids into numeric ids for bulk routes. */
export function parseItemIds(raw: unknown): number[] {
	if (Array.isArray(raw)) {
		return raw.map((value) => {
			const n = Number(value);
			if (!Number.isFinite(n)) {
				throw new Error(`Invalid item id: ${String(value)}`);
			}
			return Math.trunc(n);
		});
	}

	const text = String(raw ?? '').trim();
	if (!text) {
		throw new Error('Item ids are empty.');
	}

	if (text.startsWith('[')) {
		const parsed = JSON.parse(text) as unknown;
		return parseItemIds(parsed);
	}

	return text.split(/[\s,]+/).filter(Boolean).map((part) => {
		const n = Number(part);
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid item id: ${part}`);
		}
		return Math.trunc(n);
	});
}
