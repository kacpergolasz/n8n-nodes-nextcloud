import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	deckRequest,
	findCardOnBoard,
	formatDeckDueDate,
	mergeDefined,
	parseCardAdditionalFields,
	parseDeckCard,
	resolveCardId,
} from '../../GenericFunctions';
import { parseString } from '../../../shared/parse';
import { cardToJson } from '../shared/entityJson';
import type { CardOperationContext } from './types';

export async function cardUpdate(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	const { card: current, stackId: sourceStackId } = await findCardOnBoard(
		context,
		boardId,
		cardId,
	);
	const title = parseString(context.getNodeParameter('title', itemIndex, ''), 'Title');
	const description = parseString(
		context.getNodeParameter('description', itemIndex, ''),
		'Description',
	);
	const dueDate = parseString(context.getNodeParameter('dueDate', itemIndex, ''), 'Due date');
	const additionalFields = parseCardAdditionalFields(
		context.getNodeParameter('additionalFields', itemIndex, {}),
	);

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

	const payload = mergeDefined(current, patch);
	const card = parseDeckCard(
		await deckRequest(
			context,
			'PUT',
			`/boards/${boardId}/stacks/${sourceStackId}/cards/${cardId}`,
			payload,
		),
	);
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
