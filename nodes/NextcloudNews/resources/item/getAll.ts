import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildNewsItemsQueryParams,
	nextNewsOffsetFromItems,
	type NewsItemsQueryType,
} from '../../../shared/pagination';
import { newsRequest, unwrapItems } from '../../GenericFunctions';
import { itemToJson } from '../shared/entityJson';
import type { ItemOperationContext } from './types';

export async function itemGetAll(
	context: IExecuteFunctions,
	ctx: ItemOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const batchSize = context.getNodeParameter('batchSize', itemIndex, 50) as number;
	const offset = context.getNodeParameter('offset', itemIndex, 0) as number;
	const type = context.getNodeParameter('itemsType', itemIndex, 3) as NewsItemsQueryType;
	const scopeId = context.getNodeParameter('scopeId', itemIndex, 0) as number;
	const getRead = context.getNodeParameter('getRead', itemIndex, true) as boolean;
	const oldestFirst = context.getNodeParameter('oldestFirst', itemIndex, false) as boolean;

	const qs = buildNewsItemsQueryParams({
		batchSize,
		offset,
		type,
		id: scopeId,
		getRead,
		oldestFirst,
	});

	const items = unwrapItems(await newsRequest(context, 'GET', '/items', { qs }));
	const nextOffset = nextNewsOffsetFromItems(items);

	return items.map((item, index) => ({
		json: {
			...itemToJson(item),
			...(index === 0 && nextOffset !== undefined ? { nextOffset } : {}),
		},
		pairedItem: { item: itemIndex },
	}));
}
