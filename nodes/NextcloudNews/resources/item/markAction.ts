import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest, resolveItemId } from '../../GenericFunctions';
import { parseRequiredString } from '../../../shared/parse';
import type { ItemOperationContext } from './types';

type ItemAction = 'read' | 'unread' | 'star' | 'unstar';

export async function itemMarkAction(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
	action: ItemAction,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const itemId = resolveItemId(parseRequiredString(context.getNodeParameter('itemId', itemIndex), 'Item ID'));
	await newsRequest(context, 'POST', `/items/${itemId}/${action}`);

	return {
		json: { id: Number(itemId), action, success: true },
		pairedItem: { item: itemIndex },
	};
}
