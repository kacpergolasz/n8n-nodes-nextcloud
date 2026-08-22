import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createNewsClient, parseItemIds } from '../../GenericFunctions';
import { markItemsMultiple } from '../../repositories/NewsItem.repository';
import { getErrorMessage } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
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
	unwrapResult(
		await markItemsMultiple(await createNewsClient(context), {
			action,
			itemIds,
		}),
	);

	return {
		json: { itemIds, action, success: true },
		pairedItem: { item: itemIndex },
	};
}
