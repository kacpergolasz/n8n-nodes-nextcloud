import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { newsRequest, parseItemIds } from '../../GenericFunctions';
import { getErrorMessage } from '../../../shared/parse';
import type { ItemOperationContext } from './types';

type ItemBulkAction = 'read' | 'unread' | 'star' | 'unstar';

export async function itemMarkMultiple(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
	action: ItemBulkAction,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	let itemIds: number[];
	try {
		itemIds = parseItemIds(context.getNodeParameter('itemIds', itemIndex));
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}
	await newsRequest(context, 'POST', `/items/${action}/multiple`, {
		body: { itemIds },
	});

	return {
		json: { itemIds, action, success: true },
		pairedItem: { item: itemIndex },
	};
}
