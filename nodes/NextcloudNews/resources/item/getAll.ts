import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildNewsItemsQueryParams,
	nextNewsOffsetFromItems,
	type NewsItemsQueryType,
} from '../../../shared/pagination';
import { newsRequest, unwrapItems } from '../../GenericFunctions';
import { itemToJson } from '../shared/entityJson';
import {
	resolveOptionalFeedId,
	resolveOptionalFolderIdFilter,
} from '../shared/resolveInput';
import type { ItemOperationContext } from './types';

/**
 * Next-page cursor for authors. Returns the lowest item id on a full page,
 * or `null` when there is no further page (partial / empty / unbounded).
 */
export function newsItemsNextOffsetHint(
	items: Array<{ id: number }>,
	effectiveBatchSize: number,
): number | null {
	if (effectiveBatchSize < 1 || items.length !== effectiveBatchSize) {
		return null;
	}

	return nextNewsOffsetFromItems(items) ?? null;
}

export type NewsItemsListScopeInput = {
	feedId?: number;
	folderId?: number;
	starredOnly: boolean;
};

/**
 * Map optional UI filters to News `GET /items` type/id.
 * Precedence: feed → folder → starred only → all.
 */
export function resolveNewsItemsListScope(
	input: NewsItemsListScopeInput,
): { type: NewsItemsQueryType; id: number } {
	if (input.feedId !== undefined) {
		return { type: 0, id: input.feedId };
	}
	if (input.folderId !== undefined) {
		return { type: 1, id: input.folderId };
	}
	if (input.starredOnly) {
		return { type: 2, id: 0 };
	}
	return { type: 3, id: 0 };
}

/**
 * One n8n item: `{ items, nextOffset }` so authors can page with a stable
 * envelope (empty list included — never a zero-length execution).
 */
export async function itemGetAll(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const limit = context.getNodeParameter('limit', itemIndex, 50) as number;
	const offset = context.getNodeParameter('offset', itemIndex, 0) as number;
	const starredOnly = context.getNodeParameter('starredOnly', itemIndex, false) as boolean;
	const unreadOnly = context.getNodeParameter('unreadOnly', itemIndex, false) as boolean;
	const oldestFirst = context.getNodeParameter('oldestFirst', itemIndex, false) as boolean;

	const { type, id } = resolveNewsItemsListScope({
		feedId: resolveOptionalFeedId(context, itemIndex, 'feedFilter'),
		folderId: resolveOptionalFolderIdFilter(context, itemIndex, 'folderFilter'),
		starredOnly,
	});

	const qs = buildNewsItemsQueryParams({
		batchSize: limit,
		offset,
		type,
		id,
		getRead: !unreadOnly,
		oldestFirst,
	});

	const items = unwrapItems(await newsRequest(context, 'GET', '/items', { qs }));
	const nextOffset = newsItemsNextOffsetHint(items, qs.batchSize as number);

	return [
		{
			json: {
				items: items.map((item) => itemToJson(item)),
				nextOffset,
			},
			pairedItem: { item: itemIndex },
		},
	];
}
