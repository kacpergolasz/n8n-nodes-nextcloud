import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest } from '../../GenericFunctions';
import { resolveFeedFromInput, resolveOptionalFolderId } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedMove(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const folderId = resolveOptionalFolderId(context, itemIndex);

	await newsRequest(context, 'POST', `/feeds/${feedId}/move`, {
		body: { folderId },
	});

	return {
		json: { id: Number(feedId), folderId, moved: true },
		pairedItem: { item: itemIndex },
	};
}
