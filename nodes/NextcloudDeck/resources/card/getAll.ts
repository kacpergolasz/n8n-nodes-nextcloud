import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckStack } from '../../DeckInterface';
import { deckRequest, flattenCardsFromStacks } from '../../GenericFunctions';
import { cardToJson } from '../shared/entityJson';
import { resolveOptionalStackFilter } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardGetAll(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, boardId } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const stackFilter = resolveOptionalStackFilter(context, itemIndex);
	const stacks = (await deckRequest(
		context,
		'GET',
		`/boards/${boardId}/stacks`,
	)) as DeckStack[];
	const cards = flattenCardsFromStacks(stacks, stackFilter);
	const sliced = returnAll ? cards : cards.slice(0, limit);
	return sliced.map((card) => ({
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	}));
}
