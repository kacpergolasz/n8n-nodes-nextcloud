import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createDeckClient, toNodeJson } from '../../GenericFunctions';
import { createStack } from '../../repositories/DeckStack.repository';
import { parseRequiredNumber, parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
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
	const stack = unwrapResult(
		await createStack(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
			title,
			order,
		}),
	);
	return {
		json: toNodeJson(stack),
		pairedItem: { item: itemIndex },
	};
}