import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { applyReturnAllLimit } from '../../../shared/pagination';
import { newsRequest, unwrapFeeds } from '../../GenericFunctions';
import { feedToJson } from '../shared/entityJson';
import { resolveOptionalFolderFilter } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedGetAll(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const folderFilter = resolveOptionalFolderFilter(context, itemIndex);

	let feeds = unwrapFeeds(await newsRequest(context, 'GET', '/feeds'));
	if (folderFilter !== undefined) {
		feeds = feeds.filter((feed) => String(feed.folderId ?? '') === folderFilter);
	}

	const limited = applyReturnAllLimit(feeds, returnAll, limit);
	return limited.map((feed) => ({
		json: feedToJson(feed),
		pairedItem: { item: itemIndex },
	}));
}
