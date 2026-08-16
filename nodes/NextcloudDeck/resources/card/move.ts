import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, resolveCardId } from '../../GenericFunctions';
import { reorderCard } from '../../repositories/DeckCard.repository';
import { parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveStackFromInput } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardMove(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	const toStackId = resolveStackFromInput(context, itemIndex, 'toStack');
	const order = parseRequiredNumber(context.getNodeParameter('order', itemIndex, 0), 'Order');
	const client = await createDeckClient(context);
	const parsedBoardId = parseRequiredNumber(boardId, 'Board');
	unwrapResult(
		await reorderCard(client, {
			boardId: parsedBoardId,
			stackId: parseRequiredNumber(toStackId, 'Stack'),
			cardId: parseRequiredNumber(cardId, 'Card'),
			order,
		}),
	);
	return {
		json: { id: cardId, stackId: toStackId, order, moved: true },
		pairedItem: { item: itemIndex },
	};
}