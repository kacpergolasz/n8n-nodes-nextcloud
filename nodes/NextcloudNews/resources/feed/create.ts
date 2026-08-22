import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { createFeed } from '../../repositories/NewsFeed.repository';
import { parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { feedToJson } from '../shared/entityJson';
import { resolveOptionalFolderId } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

export async function feedCreate(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedUrl = parseRequiredString(context.getNodeParameter('feedUrl', itemIndex), 'Feed URL');
	if (!feedUrl.trim()) {
		throw new NodeOperationError(context.getNode(), 'Feed URL is required when creating a feed', {
			itemIndex,
		});
	}

	const folderId = resolveOptionalFolderId(context, itemIndex);

	const feed = unwrapResult(
		await createFeed(await createNewsClient(context), {
			url: feedUrl.trim(),
			folderId,
		}),
	);

	return {
		json: feedToJson(feed),
		pairedItem: { item: itemIndex },
	};
}
