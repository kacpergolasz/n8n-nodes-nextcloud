import { createHash } from 'node:crypto';

import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { z } from 'zod';

import type {
	NewsFeed,
	NewsFolder,
	NewsItem,
	NewsPickerOption,
} from './NewsInterface';
import {
	isPlainObject,
	parseNextcloudCredentials,
	throwParseError,
	type NextcloudCredentialData,
} from '../shared/parse';

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
	const credentials = parseNextcloudCredentials(await context.getCredentials('nextcloudApi'));

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

const newsFolderSchema = z
	.object({
		id: z.coerce.number().int().positive(),
		name: z.string(),
	})
	.passthrough();

const newsFeedSchema = z
	.object({
		id: z.coerce.number().int().positive(),
		url: z.string(),
		title: z.string(),
		faviconLink: z.union([z.string(), z.null()]).optional(),
		added: z.number().optional(),
		folderId: z.union([z.number(), z.null()]).optional(),
		unreadCount: z.number().optional(),
		link: z.union([z.string(), z.null()]).optional(),
		pinned: z.boolean().optional(),
	})
	.passthrough();

const newsItemSchema = z
	.object({
		id: z.coerce.number().int().positive(),
		guid: z.string().optional(),
		guidHash: z.string().optional(),
		url: z.union([z.string(), z.null()]).optional(),
		title: z.union([z.string(), z.null()]).optional(),
		author: z.union([z.string(), z.null()]).optional(),
		pubDate: z.number().optional(),
		body: z.union([z.string(), z.null()]).optional(),
		feedId: z.number().optional(),
		unread: z.boolean().optional(),
		starred: z.boolean().optional(),
		lastModified: z.number().optional(),
	})
	.passthrough();

function parseNewsFolder(data: unknown): NewsFolder {
	try {
		return newsFolderSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid News folder payload');
	}
}

function parseNewsFeed(data: unknown): NewsFeed {
	try {
		return newsFeedSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid News feed payload');
	}
}

function parseNewsItem(data: unknown): NewsItem {
	try {
		return newsItemSchema.parse(data);
	} catch (error) {
		throwParseError(error, 'Invalid News item payload');
	}
}

export function unwrapFolders(response: unknown): NewsFolder[] {
	if (Array.isArray(response)) {
		return response.map(parseNewsFolder);
	}
	if (isPlainObject(response)) {
		const folders = response.folders;
		if (Array.isArray(folders)) {
			return folders.map(parseNewsFolder);
		}
	}
	return [];
}

export function unwrapFeeds(response: unknown): NewsFeed[] {
	if (Array.isArray(response)) {
		return response.map(parseNewsFeed);
	}
	if (isPlainObject(response)) {
		const feeds = response.feeds;
		if (Array.isArray(feeds)) {
			return feeds.map(parseNewsFeed);
		}
	}
	return [];
}

export function unwrapItems(response: unknown): NewsItem[] {
	if (Array.isArray(response)) {
		return response.map(parseNewsItem);
	}
	if (isPlainObject(response)) {
		const items = response.items;
		if (Array.isArray(items)) {
			return items.map(parseNewsItem);
		}
	}
	return [];
}

/** Prefer a single created entity; fall back to first list entry. */
export function firstFolder(response: unknown): NewsFolder | undefined {
	if (isPlainObject(response) && 'id' in response && 'name' in response) {
		return parseNewsFolder(response);
	}
	return unwrapFolders(response)[0];
}

export function firstFeed(response: unknown): NewsFeed | undefined {
	if (isPlainObject(response) && 'id' in response && 'url' in response) {
		return parseNewsFeed(response);
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
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = undefined;
		}
		if (parsed === undefined) {
			throw new Error('Item ids must be a valid JSON array or comma-separated list');
		}
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
