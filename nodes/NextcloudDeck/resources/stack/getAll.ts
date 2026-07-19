import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckStack } from '../../DeckInterface';
import { deckRequest } from '../../GenericFunctions';
import { stackToJson } from '../shared/entityJson';
import type { StackOperationContext } from './types';

export async function stackGetAll(
	context: IExecuteFunctions,
	ctx: StackOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, boardId } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const stacks = (await deckRequest(
		context,
		'GET',
		`/boards/${boardId}/stacks`,
	)) as DeckStack[];
	const sliced = returnAll ? stacks : stacks.slice(0, limit);
	return sliced.map((stack) => ({
		json: stackToJson(stack),
		pairedItem: { item: itemIndex },
	}));
}
