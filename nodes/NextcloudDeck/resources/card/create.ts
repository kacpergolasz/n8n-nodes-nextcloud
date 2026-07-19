import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { DeckCard } from '../../DeckInterface';
import { deckRequest, formatDeckDueDate } from '../../GenericFunctions';
import { cardToJson } from '../shared/entityJson';
import { resolveStackFromInput } from '../shared/resolveInput';
import type { CardOperationContext } from './types';

export async function cardCreate(
	context: IExecuteFunctions,
	ctx: CardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const stackId = resolveStackFromInput(context, itemIndex);
	const title = context.getNodeParameter('title', itemIndex) as string;
	const description = context.getNodeParameter('description', itemIndex, '') as string;
	const dueDate = context.getNodeParameter('dueDate', itemIndex, '') as string;
	const type = context.getNodeParameter('type', itemIndex, 'plain') as string;
	const order = context.getNodeParameter('order', itemIndex, 0) as number;
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
	const card = (await deckRequest(
		context,
		'POST',
		`/boards/${boardId}/stacks/${stackId}/cards`,
		body,
	)) as DeckCard;
	return {
		json: cardToJson(card),
		pairedItem: { item: itemIndex },
	};
}
