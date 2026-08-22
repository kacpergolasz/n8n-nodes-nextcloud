/**
 * Repository for the News Item entity (External API v1-3).
 *
 * Reference: nodes/NextcloudNews/context/api/documentation/openapi.md (Items)
 */
import { z } from 'zod';

import type { NewsClient } from '../news.client';
import { isPlainObject } from '../../shared/parse';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

export const newsItemSchema = z.object({
	id: z.coerce.number().int().positive(),
	guid: z.string().optional(),
	guidHash: z.string().optional(),
	url: z.union([z.string(), z.null()]).optional(),
	title: z.union([z.string(), z.null()]).optional(),
	author: z.union([z.string(), z.null()]).optional(),
	pubDate: z.number().nullish(),
	body: z.union([z.string(), z.null()]).optional(),
	enclosureMime: z.union([z.string(), z.null()]).optional(),
	enclosureLink: z.union([z.string(), z.null()]).optional(),
	mediaThumbnail: z.union([z.string(), z.null()]).optional(),
	mediaDescription: z.union([z.string(), z.null()]).optional(),
	feedId: z.number().optional(),
	unread: z.boolean().optional(),
	starred: z.boolean().optional(),
	filtered: z.boolean().optional(),
	rtl: z.boolean().optional(),
	lastModified: z.union([z.number(), z.string(), z.null()]).optional(),
	fingerprint: z.union([z.string(), z.null()]).optional(),
	contentHash: z.union([z.string(), z.null()]).optional(),
	updatedDate: z.union([z.string(), z.null()]).optional(),
});

const newsItemsListSchema = z.array(newsItemSchema);

export type NewsItem = z.infer<typeof newsItemSchema>;

function parseItemsList(result: Maybe<unknown>): Maybe<NewsItem[]> {
	if (!result.success) {
		return result;
	}
	const raw =
		isPlainObject(result.response) && Array.isArray(result.response.items)
			? result.response.items
			: result.response;
	return parseWith({ success: true, response: raw }, newsItemsListSchema);
}

export type GetItemsOptions = {
	batchSize?: number;
	offset?: number;
	type?: number;
	id?: number;
	getRead?: boolean;
	oldestFirst?: boolean;
};

function itemsQuery(options: GetItemsOptions): Record<string, string | number | boolean> {
	const query: Record<string, string | number | boolean> = {};
	if (options.batchSize !== undefined) {
		query.batchSize = options.batchSize;
	}
	if (options.offset !== undefined) {
		query.offset = options.offset;
	}
	if (options.type !== undefined) {
		query.type = options.type;
	}
	if (options.id !== undefined) {
		query.id = options.id;
	}
	if (options.getRead !== undefined) {
		query.getRead = options.getRead;
	}
	if (options.oldestFirst !== undefined) {
		query.oldestFirst = options.oldestFirst;
	}
	return query;
}

export async function getItems(
	client: NewsClient,
	options: GetItemsOptions = {},
): Promise<Maybe<NewsItem[]>> {
	return parseItemsList(await client.get('/items', itemsQuery(options)));
}

export type ItemAction = 'read' | 'unread' | 'star' | 'unstar';

export type MarkItemActionOptions = {
	itemId: number;
	action: ItemAction;
};

export async function markItemAction(
	client: NewsClient,
	options: MarkItemActionOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.post(`/items/${options.itemId}/${options.action}`));
}

export type MarkItemsMultipleOptions = {
	action: ItemAction;
	itemIds: number[];
};

export async function markItemsMultiple(
	client: NewsClient,
	options: MarkItemsMultipleOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.post(`/items/${options.action}/multiple`, { itemIds: options.itemIds }),
	);
}
