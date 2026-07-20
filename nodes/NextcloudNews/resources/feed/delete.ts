import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest } from '../../GenericFunctions';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedDelete(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	await newsRequest(context, 'DELETE', `/feeds/${feedId}`);

	return {
		json: { id: Number(feedId), deleted: true },
		pairedItem: { item: itemIndex },
	};
}
