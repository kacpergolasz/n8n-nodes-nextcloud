import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createDeckClient, formatDeckDueDate, toNodeJson } from '../../GenericFunctions';
import { createCard } from '../../repositories/DeckCard.repository';
import { parseRequiredNumber, parseRequiredString, parseString } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
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
	const card = unwrapResult(
		await createCard(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
			stackId: parseRequiredNumber(stackId, 'Stack'),
			title,
			type: type || 'plain',
			order,
			description: description.trim() ? description : undefined,
			duedate: formatDeckDueDate(dueDate),
		}),
	);
		return {
		json: toNodeJson(card),
		pairedItem: { item: itemIndex },
	};
}
