import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest } from '../../GenericFunctions';
import { parseRequiredNumber } from '../../../shared/parse';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedMarkRead(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const newestItemId = parseRequiredNumber(context.getNodeParameter('newestItemId', itemIndex), 'Newest Item ID');

	await newsRequest(context, 'POST', `/feeds/${feedId}/read`, {
		body: { newestItemId },
	});

	return {
		json: { id: Number(feedId), newestItemId, markedRead: true },
		pairedItem: { item: itemIndex },
	};
}
