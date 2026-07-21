import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deckRequest, flattenCardsFromStacks, parseDeckStacks } from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { cardToJson } from '../shared/entityJson';
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
	const stacks = parseDeckStacks(await deckRequest(context, 'GET', `/boards/${boardId}/stacks`));
	const cards = flattenCardsFromStacks(stacks, stackFilter);
	const sliced = returnAll ? cards : cards.slice(0, limit);
	return sliced.map((card) => ({
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	}));
}
