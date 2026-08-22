import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createNewsClient, resolveItemId } from '../../GenericFunctions';
import { markItemAction } from '../../repositories/NewsItem.repository';
import { parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import type { ItemOperationContext } from './types';

type ItemAction = 'read' | 'unread' | 'star' | 'unstar';

export async function itemMarkAction(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
	action: ItemAction,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const itemId = resolveItemId(parseRequiredString(context.getNodeParameter('itemId', itemIndex), 'Item ID'));
	unwrapResult(
		await markItemAction(await createNewsClient(context), {
			itemId: Number(itemId),
			action,
		}),
	);

	return {
		json: { id: Number(itemId), action, success: true },
		pairedItem: { item: itemIndex },
	};
}
