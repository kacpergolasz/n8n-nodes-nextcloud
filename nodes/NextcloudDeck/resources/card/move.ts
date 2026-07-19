import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { moveCard, resolveCardId } from '../../GenericFunctions';
import { cardToJson } from '../shared/entityJson';
import { resolveStackFromInput } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardMove(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex) as string);
	const toStackId = resolveStackFromInput(context, itemIndex, 'toStack');
	const order = context.getNodeParameter('order', itemIndex, 0) as number;
	const card = await moveCard(context, boardId, cardId, toStackId, order);
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
