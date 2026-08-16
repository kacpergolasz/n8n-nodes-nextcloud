import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, resolveCardId } from '../../GenericFunctions';
import { deleteCard } from '../../repositories/DeckCard.repository';
import { parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveCardStackId } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardDelete(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	const client = await createDeckClient(context);
	const parsedBoardId = parseRequiredNumber(boardId, 'Board');
	unwrapResult(
		await deleteCard(client, {
			boardId: parsedBoardId,
			stackId: await resolveCardStackId(client, parsedBoardId, cardId),
			cardId: parseRequiredNumber(cardId, 'Card'),
		}),
	);
	return {
		json: { id: cardId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}