import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckCard } from '../../DeckInterface';
import {
	deckRequest,
	findCardOnBoard,
	formatDeckDueDate,
	mergeDefined,
	resolveCardId,
} from '../../GenericFunctions';
import { cardToJson } from '../shared/entityJson';
import type { CardOperationContext } from './types';

export async function cardUpdate(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex) as string);
	const { card: current, stackId: sourceStackId } = await findCardOnBoard(
		context,
		boardId,
		cardId,
	);
	const title = context.getNodeParameter('title', itemIndex, '') as string;
	const description = context.getNodeParameter('description', itemIndex, '') as string;
	const dueDate = context.getNodeParameter('dueDate', itemIndex, '') as string;
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

	const patch: IDataObject = {};
	if (title.trim()) {
		patch.title = title;
	}
	if (description.trim()) {
		patch.description = description;
	}
	if (additionalFields.clearDueDate === true) {
		patch.duedate = null;
	} else if (dueDate.trim()) {
		patch.duedate = formatDeckDueDate(dueDate);
	}

	const payload = mergeDefined(current as IDataObject, patch);
	const card = (await deckRequest(
		context,
		'PUT',
		`/boards/${boardId}/stacks/${sourceStackId}/cards/${cardId}`,
		payload,
	)) as DeckCard;
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
