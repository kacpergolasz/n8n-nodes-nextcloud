import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { newsRequest } from '../../GenericFunctions';
import { parseRequiredString } from '../../../shared/parse';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedRename(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const feedTitle = parseRequiredString(context.getNodeParameter('feedTitle', itemIndex), 'Feed Title');
	if (!feedTitle.trim()) {
		throw new NodeOperationError(context.getNode(), 'Feed title is required when renaming a feed', {
			itemIndex,
		});
	}

	await newsRequest(context, 'POST', `/feeds/${feedId}/rename`, {
		body: { feedTitle },
	});

	return {
		json: { id: Number(feedId), title: feedTitle, renamed: true },
		pairedItem: { item: itemIndex },
	};
}
