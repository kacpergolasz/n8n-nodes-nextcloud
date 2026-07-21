import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	feedUrlHash,
	findFeedById,
	newsRequest,
} from '../../GenericFunctions';
import { parseBinaryBuffer, parseRequiredString } from '../../../shared/parse';
import { resolveFeedFromInput } from '../shared/resolveInput';
import type { FeedOperationContext } from './types';

function mimeFromFaviconBuffer(buffer: Buffer): { mimeType: string; extension: string } {
	if (
		buffer.length >= 8 &&
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return { mimeType: 'image/png', extension: 'png' };
	}
	if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return { mimeType: 'image/jpeg', extension: 'jpg' };
	}
	if (
		buffer.length >= 6 &&
		(buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
			buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
	) {
		return { mimeType: 'image/gif', extension: 'gif' };
	}
	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
		buffer.subarray(8, 12).toString('ascii') === 'WEBP'
	) {
		return { mimeType: 'image/webp', extension: 'webp' };
	}
	const head = buffer.subarray(0, Math.min(256, buffer.length)).toString('utf8').trimStart();
	if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
		return { mimeType: 'image/svg+xml', extension: 'svg' };
	}
	return { mimeType: 'image/x-icon', extension: 'ico' };
}

export async function feedFavicon(
	context: IExecuteFunctions,
	ctx: FeedOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const feedId = resolveFeedFromInput(context, itemIndex);
	const binaryPropertyName = parseRequiredString(context.getNodeParameter('binaryPropertyName', itemIndex), 'Binary Property Name');

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
	const buffer = parseBinaryBuffer(response);
	const { mimeType, extension } = mimeFromFaviconBuffer(buffer);
	const fileName = `favicon-${feedId}.${extension}`;
	const binaryData = await context.helpers.prepareBinaryData(buffer, fileName, mimeType);

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
