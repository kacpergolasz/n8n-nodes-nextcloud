import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { DeckStack } from '../../DeckInterface';
import { deckRequest } from '../../GenericFunctions';
import { stackToJson } from '../shared/entityJson';
import type { StackOperationContext } from './types';

export async function stackCreate(
	context: IExecuteFunctions,
	ctx: StackOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, boardId } = ctx;
	const title = context.getNodeParameter('title', itemIndex) as string;
	const order = context.getNodeParameter('order', itemIndex, 0) as number;
	if (!title.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Title is required when creating a stack',
			{ itemIndex },
		);
	}
	const stack = (await deckRequest(context, 'POST', `/boards/${boardId}/stacks`, {
		title,
		order,
	})) as DeckStack;
	return {
		json: stackToJson(stack),
		pairedItem: { item: itemIndex },
	};
}
