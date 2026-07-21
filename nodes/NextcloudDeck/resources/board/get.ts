import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deckRequest, parseDeckBoard } from '../../GenericFunctions';
import { boardToJson } from '../shared/entityJson';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardGet(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	const board = parseDeckBoard(await deckRequest(context, 'GET', `/boards/${boardId}`));
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
