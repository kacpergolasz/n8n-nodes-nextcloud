import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { moveFeed } from '../../repositories/NewsFeed.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveFeedFromInput, resolveOptionalFolderId } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedMove(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const folderId = resolveOptionalFolderId(context, itemIndex);

	unwrapResult(
		await moveFeed(await createNewsClient(context), {
			feedId: Number(feedId),
			folderId,
		}),
	);

	return {
		json: { id: Number(feedId), folderId, moved: true },
		pairedItem: { item: itemIndex },
	};
}
