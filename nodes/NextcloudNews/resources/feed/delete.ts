import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { deleteFeed } from '../../repositories/NewsFeed.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedDelete(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	unwrapResult(
		await deleteFeed(await createNewsClient(context), { feedId: Number(feedId) }),
	);

	return {
		json: { id: Number(feedId), deleted: true },
		pairedItem: { item: itemIndex },
	};
}
