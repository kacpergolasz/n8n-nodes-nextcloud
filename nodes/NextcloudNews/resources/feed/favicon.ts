import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	feedUrlHash,
	findFeedById,
	newsRequest,
} from '../../GenericFunctions';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedFavicon(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex) as string;

	const feed = await findFeedById(context, feedId);
	if (!feed?.url) {
		throw new NodeOperationError(
			context.getNode(),
			`Feed ${feedId} was not found or has no URL for favicon lookup`,
			{ itemIndex },
		);
	}

	const hash = feedUrlHash(feed.url);
	const response = await newsRequest(context, 'GET', `/favicon/${hash}`, {
		json: false,
		encoding: 'arraybuffer',
	});
	const buffer = Buffer.from(response as ArrayBuffer);
	const fileName = `favicon-${feedId}.ico`;
	const binaryData = await context.helpers.prepareBinaryData(buffer, fileName, 'image/x-icon');

	return {
		json: {
			feedId: Number(feedId),
			feedUrl: feed.url,
			faviconHash: hash,
			fileName,
		},
		binary: {
			[binaryPropertyName]: binaryData,
		},
		pairedItem: { item: itemIndex },
	};
}
