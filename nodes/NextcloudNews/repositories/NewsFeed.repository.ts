/**
 * Repository for the News Feed entity (External API v1-3).
 *
 * Reference: nodes/NextcloudNews/context/api/documentation/openapi.md (Feeds, Favicon)
 */
import { z } from 'zod';

import type { NewsClient } from '../news.client';
import { isPlainObject, parseBinaryBuffer } from '../../shared/parse';
import { parseEmpty, parseWith, type Maybe } from '../../shared/apiResult';

export const newsFeedSchema = z.object({
	id: z.coerce.number().int().positive(),
	url: z.string(),
	title: z.string(),
	faviconLink: z.union([z.string(), z.null()]).optional(),
	added: z.number().nullish(),
	nextUpdateTime: z.number().nullish(),
	folderId: z.union([z.number(), z.null()]).optional(),
	unreadCount: z.number().nullish(),
	ordering: z.number().nullish(),
	link: z.union([z.string(), z.null()]).optional(),
	pinned: z.boolean().optional(),
	updateErrorCount: z.number().nullish(),
	lastUpdateError: z.union([z.string(), z.null()]).optional(),
});

const newsFeedsListSchema = z.array(newsFeedSchema);

export type NewsFeed = z.infer<typeof newsFeedSchema>;

function parseFeedsList(result: Maybe<unknown>): Maybe<NewsFeed[]> {
	if (!result.success) {
		return result;
	}
	const raw =
		isPlainObject(result.response) && Array.isArray(result.response.feeds)
			? result.response.feeds
			: result.response;
	return parseWith({ success: true, response: raw }, newsFeedsListSchema);
}

export async function getFeeds(client: NewsClient): Promise<Maybe<NewsFeed[]>> {
	return parseFeedsList(await client.get('/feeds'));
}

export type CreateFeedOptions = {
	url: string;
	folderId?: number | null;
};

export async function createFeed(
	client: NewsClient,
	options: CreateFeedOptions,
): Promise<Maybe<NewsFeed>> {
	const body: Record<string, unknown> = { url: options.url };
	if (options.folderId !== undefined) {
		body.folderId = options.folderId;
	}
	const result = parseFeedsList(await client.post('/feeds', body));
	if (!result.success) {
		return result;
	}
	const feed = result.response[0];
	if (!feed) {
		return { success: false, error: new Error('Feed create returned an empty response') };
	}
	return { success: true, response: feed };
}

export type DeleteFeedOptions = {
	feedId: number;
};

export async function deleteFeed(
	client: NewsClient,
	options: DeleteFeedOptions,
): Promise<Maybe<null>> {
	return parseEmpty(await client.delete(`/feeds/${options.feedId}`));
}

export type MoveFeedOptions = {
	feedId: number;
	folderId: number | null;
};

export async function moveFeed(
	client: NewsClient,
	options: MoveFeedOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.post(`/feeds/${options.feedId}/move`, { folderId: options.folderId }),
	);
}

export type RenameFeedOptions = {
	feedId: number;
	feedTitle: string;
};

export async function renameFeed(
	client: NewsClient,
	options: RenameFeedOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.post(`/feeds/${options.feedId}/rename`, { feedTitle: options.feedTitle }),
	);
}

export type MarkFeedReadOptions = {
	feedId: number;
	newestItemId: number;
};

export async function markFeedRead(
	client: NewsClient,
	options: MarkFeedReadOptions,
): Promise<Maybe<null>> {
	return parseEmpty(
		await client.post(`/feeds/${options.feedId}/read`, {
			newestItemId: options.newestItemId,
		}),
	);
}

export type GetFaviconOptions = {
	feedUrlHash: string;
};

export async function getFavicon(
	client: NewsClient,
	options: GetFaviconOptions,
): Promise<Maybe<Buffer>> {
	const result = await client.get(`/favicon/${options.feedUrlHash}`, undefined, undefined, {
		json: false,
		encoding: 'arraybuffer',
	});
	if (!result.success) {
		return result;
	}
	try {
		return { success: true, response: parseBinaryBuffer(result.response) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}
