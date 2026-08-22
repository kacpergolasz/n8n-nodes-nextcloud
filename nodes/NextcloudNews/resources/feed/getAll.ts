import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { applyReturnAllLimit } from '../../../shared/pagination';
import { createNewsClient } from '../../GenericFunctions';
import { getFeeds } from '../../repositories/NewsFeed.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { feedToJson } from '../shared/entityJson';
import { resolveOptionalFolderFilter } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedGetAll(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = parseRequiredBoolean(context.getNodeParameter('returnAll', itemIndex, false), 'Return All');
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const folderFilter = resolveOptionalFolderFilter(context, itemIndex);

	let feeds = unwrapResult(await getFeeds(await createNewsClient(context)));
	if (folderFilter !== undefined) {
		feeds = feeds.filter((feed) => String(feed.folderId ?? '') === folderFilter);
	}

	const limited = applyReturnAllLimit(feeds, returnAll, limit);
	return limited.map((feed) => ({
		json: feedToJson(feed),
		pairedItem: { item: itemIndex },
	}));
}
