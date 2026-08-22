import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, resolveCardId, toNodeJson } from '../../GenericFunctions';
import { parseRequiredNumber } from '../../../shared/parse';
import { getCard } from '../../repositories/DeckCard.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveCardStackId } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardGet(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	const client = await createDeckClient(context);
	const parsedBoardId = parseRequiredNumber(boardId, 'Board');
	const card = unwrapResult(
		await getCard(client, {
			boardId: parsedBoardId,
			stackId: await resolveCardStackId(client, parsedBoardId, cardId),
			cardId: parseRequiredNumber(cardId, 'Card'),
		}),
	);
	return {
		json: toNodeJson(card),
		pairedItem: { item: itemIndex },
	};
}