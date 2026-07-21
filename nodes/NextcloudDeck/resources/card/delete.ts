import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deleteCard, resolveCardId } from '../../GenericFunctions';
import type { CardOperationContext } from './types';

export async function cardDelete(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	await deleteCard(context, boardId, cardId);
	return {
		json: { id: cardId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
