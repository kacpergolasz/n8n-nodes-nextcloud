import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { deckRequest, parseDeckStack } from '../../GenericFunctions';
import { parseRequiredNumber, parseRequiredString } from '../../../shared/parse';
import { stackToJson } from '../shared/entityJson';
import type { StackOperationContext } from './types';

export async function stackCreate(
	context: IExecuteFunctions,
	ctx: StackOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const title = parseRequiredString(context.getNodeParameter('title', itemIndex), 'Title');
	const order = parseRequiredNumber(context.getNodeParameter('order', itemIndex, 0), 'Order');
	if (!title.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Title is required when creating a stack',
			{ itemIndex },
		);
	}
	const stack = parseDeckStack(
		await deckRequest(context, 'POST', `/boards/${boardId}/stacks`, {
			title,
			order,
		}),
	);
	return {
		json: stackToJson(stack),
		pairedItem: { item: itemIndex },
	};
}
