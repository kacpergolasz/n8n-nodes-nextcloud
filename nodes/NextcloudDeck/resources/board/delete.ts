import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deckRequest } from '../../GenericFunctions';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardDelete(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	await deckRequest(context, 'DELETE', `/boards/${boardId}`);
	return {
		json: { id: boardId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
