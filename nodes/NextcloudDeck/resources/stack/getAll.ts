import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deckRequest, parseDeckStacks } from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { stackToJson } from '../shared/entityJson';
import type { StackOperationContext } from './types';

export async function stackGetAll(
	context: IExecuteFunctions,
	ctx: StackOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, boardId } = ctx;
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return All',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const stacks = parseDeckStacks(await deckRequest(context, 'GET', `/boards/${boardId}/stacks`));
	const sliced = returnAll ? stacks : stacks.slice(0, limit);
	return sliced.map((stack) => ({
		json: stackToJson(stack),
		pairedItem: { item: itemIndex },
	}));
}
