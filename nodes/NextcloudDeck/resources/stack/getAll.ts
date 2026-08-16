import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, toNodeJson } from '../../GenericFunctions';
import { getStacks } from '../../repositories/DeckStack.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import type { StackOperationContext } from './types';

export async function stackGetAll(
	context: IExecuteFunctions,
	ctx: StackOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, boardId } = ctx;
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return All',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const stacks = unwrapResult(
		await getStacks(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
		}),
	);
	const sliced = returnAll ? stacks : stacks.slice(0, limit);
	return sliced.map((stack) => ({
		json: toNodeJson(stack),
		pairedItem: { item: itemIndex },
	}));
}