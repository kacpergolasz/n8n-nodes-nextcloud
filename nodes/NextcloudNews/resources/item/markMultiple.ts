import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest, parseItemIds } from '../../GenericFunctions';
import type { ItemOperationContext } from './types';

type ItemBulkAction = 'read' | 'unread' | 'star' | 'unstar';

export async function itemMarkMultiple(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
	action: ItemBulkAction,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const itemIds = parseItemIds(context.getNodeParameter('itemIds', itemIndex));
	await newsRequest(context, 'POST', `/items/${action}/multiple`, {
		body: { itemIds },
	});

	return {
		json: { itemIds, action, success: true },
		pairedItem: { item: itemIndex },
	};
}
