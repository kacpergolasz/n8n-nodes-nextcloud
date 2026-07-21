import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { deckRequest, formatDeckDueDate, parseDeckCard } from '../../GenericFunctions';
import { parseRequiredNumber, parseRequiredString, parseString } from '../../../shared/parse';
import { cardToJson } from '../shared/entityJson';
import { resolveStackFromInput } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardCreate(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const stackId = resolveStackFromInput(context, itemIndex);
	const title = parseRequiredString(context.getNodeParameter('title', itemIndex), 'Title');
	const description = parseString(
		context.getNodeParameter('description', itemIndex, ''),
		'Description',
	);
	const dueDate = parseString(context.getNodeParameter('dueDate', itemIndex, ''), 'Due date');
	const type = parseString(context.getNodeParameter('type', itemIndex, 'plain'), 'Type');
	const order = parseRequiredNumber(context.getNodeParameter('order', itemIndex, 0), 'Order');
	if (!title.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Title is required when creating a card',
			{ itemIndex },
		);
	}
	const body: IDataObject = {
		title,
		type: type || 'plain',
		order,
		duedate: formatDeckDueDate(dueDate),
	};
	if (description.trim()) {
		body.description = description;
	}
	const card = parseDeckCard(
		await deckRequest(
			context,
			'POST',
			`/boards/${boardId}/stacks/${stackId}/cards`,
			body,
		),
	);
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
