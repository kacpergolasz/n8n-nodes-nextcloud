import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { firstFeed, newsRequest } from '../../GenericFunctions';
import { feedToJson } from '../shared/entityJson';
import { resolveOptionalFolderId } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedCreate(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedUrl = context.getNodeParameter('feedUrl', itemIndex) as string;
	if (!feedUrl.trim()) {
		throw new NodeOperationError(context.getNode(), 'Feed URL is required when creating a feed', {
			itemIndex,
		});
	}

	const folderId = resolveOptionalFolderId(context, itemIndex);

	const response = await newsRequest(context, 'POST', '/feeds', {
		body: {
			url: feedUrl.trim(),
			folderId,
		},
	});
	const feed = firstFeed(response);
	if (!feed) {
		throw new NodeOperationError(context.getNode(), 'Feed create returned an empty response', {
			itemIndex,
		});
	}

	return {
		json: feedToJson(feed),
		pairedItem: { item: itemIndex },
	};
}
