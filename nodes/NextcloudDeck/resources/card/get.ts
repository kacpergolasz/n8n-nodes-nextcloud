import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { findCardOnBoard, resolveCardId } from '../../GenericFunctions';
import { cardToJson } from '../shared/entityJson';
import type { CardOperationContext } from './types';

export async function cardGet(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex) as string);
	const { card } = await findCardOnBoard(context, boardId, cardId);
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
