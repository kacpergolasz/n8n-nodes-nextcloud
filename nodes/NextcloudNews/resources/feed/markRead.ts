import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { markFeedRead } from '../../repositories/NewsFeed.repository';
import { parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedMarkRead(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const newestItemId = parseRequiredNumber(context.getNodeParameter('newestItemId', itemIndex), 'Newest Item ID');

	unwrapResult(
		await markFeedRead(await createNewsClient(context), {
			feedId: Number(feedId),
			newestItemId,
		}),
	);

	return {
		json: { id: Number(feedId), newestItemId, markedRead: true },
		pairedItem: { item: itemIndex },
	};
}
