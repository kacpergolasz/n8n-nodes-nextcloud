import { createHash } from 'node:crypto';

import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

import type { NewsClient } from './news.client';
import { NewsClient as NewsClientImpl } from './news.client';
import type { NewsFeed, NewsItem, NewsPickerOption } from './NewsInterface';
import { getFeeds } from './repositories/NewsFeed.repository';
import { getFolders } from './repositories/NewsFolder.repository';
import { newsItemSchema } from './repositories/NewsItem.repository';
import {
	isPlainObject,
	parseNextcloudCredentials,
	throwParseError,
	type NextcloudCredentialData,
} from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import { unwrapResult } from '../shared/apiResult';

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
	context: NextcloudRequestContext,
): Promise<NextcloudCredentialData> {
	const credentials = parseNextcloudCredentials(await context.getCredentials('nextcloudApi'));

	return {
		baseUrl: normalizeBaseUrl(credentials.baseUrl),
		username: credentials.username,
		appPassword: credentials.appPassword,
	};
}

/** Build a NewsClient that sends News REST calls through n8n's authenticated HTTP helper. */
export async function createNewsClient(context: NextcloudRequestContext): Promise<NewsClient> {
	return await NewsClientImpl.fromN8nContext(context);
}

/**
 * Legacy HTTP helper retained for NextcloudNewsTrigger until Phase 4 rewires it
 * to repositories. New News resources must use repositories + createNewsClient.
 */
export async function newsRequest(
	context: NextcloudRequestContext,
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

/**
 * Legacy unwrap retained for NextcloudNewsTrigger until Phase 4.
 * Prefer repository `getItems` for new code.
 */
export function unwrapItems(response: unknown): NewsItem[] {
	const parseItem = (data: unknown): NewsItem => {
		try {
			return newsItemSchema.parse(data);
		} catch (error) {
			throwParseError(error, 'Invalid News item payload');
		}
	};

	if (Array.isArray(response)) {
		return response.map(parseItem);
	}
	if (isPlainObject(response)) {
		const items = response.items;
		if (Array.isArray(items)) {
			return items.map(parseItem);
		}
		throw new Error('Invalid News items response: expected { items: [...] }');
	}
	throw new Error('Invalid News items response: expected array or { items: [...] }');
}

export async function loadFolders(
	context: NextcloudRequestContext,
): Promise<NewsPickerOption[]> {
	const folders = unwrapResult(await getFolders(await createNewsClient(context)));

	return folders.map((folder) => ({
		name: folder.name,
		value: String(folder.id),
	}));
}

export async function loadFeeds(
	context: NextcloudRequestContext,
	folderId?: string,
): Promise<NewsPickerOption[]> {
	let feeds = unwrapResult(await getFeeds(await createNewsClient(context)));

	if (folderId !== undefined && folderId !== '') {
		feeds = feeds.filter((feed) => String(feed.folderId ?? '') === folderId);
	}

	return feeds.map((feed) => ({
		name: feed.title || feed.url || String(feed.id),
		value: String(feed.id),
	}));
}

export async function findFeedById(
	context: NextcloudRequestContext,
	feedId: string,
): Promise<NewsFeed | undefined> {
	const feeds = unwrapResult(await getFeeds(await createNewsClient(context)));
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
