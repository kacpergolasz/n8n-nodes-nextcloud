import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildCardUpdatePayload,
	createDeckClient,
	formatDeckDueDate,
	parseCardAdditionalFields,
	resolveCardId,
	toNodeJson,
	type CardUpdatePatch,
} from '../../GenericFunctions';
import { getCard, updateCard } from '../../repositories/DeckCard.repository';
import { parseRequiredNumber, parseString } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveCardStackId } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardUpdate(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const cardId = resolveCardId(context.getNodeParameter('cardId', itemIndex));
	const client = await createDeckClient(context);
	const parsedBoardId = parseRequiredNumber(boardId, 'Board');
	const parsedCardId = parseRequiredNumber(cardId, 'Card');
	const stackId = await resolveCardStackId(client, parsedBoardId, cardId);
	const current = unwrapResult(
		await getCard(client, { boardId: parsedBoardId, stackId, cardId: parsedCardId }),
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

	const patch: CardUpdatePatch = {};
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

	const card = unwrapResult(
		await updateCard(client, {
			boardId: parsedBoardId,
			stackId,
			cardId: parsedCardId,
			...buildCardUpdatePayload(current, patch),
		}),
	);
	return {
		json: toNodeJson(card),
		pairedItem: { item: itemIndex },
	};
}