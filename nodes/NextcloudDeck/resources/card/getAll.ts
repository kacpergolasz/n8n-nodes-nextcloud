import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, toNodeJson } from '../../GenericFunctions';
import { getStacks } from '../../repositories/DeckStack.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveOptionalStackFilter } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardGetAll(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, boardId } = ctx;
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return All',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const stackFilter = resolveOptionalStackFilter(context, itemIndex);
	const stacks = unwrapResult(
		await getStacks(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
		}),
	);
	const cards = stacks
		.filter((stack) => !stackFilter || String(stack.id) === stackFilter)
		.flatMap((stack) => stack.cards);
	const sliced = returnAll ? cards : cards.slice(0, limit);
	return sliced.map((card) => ({
		json: toNodeJson(card),
		pairedItem: { item: itemIndex },
	}));
}