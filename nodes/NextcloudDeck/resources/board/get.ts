import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckBoard } from '../../DeckInterface';
import { deckRequest } from '../../GenericFunctions';
import { boardToJson } from '../shared/entityJson';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardGet(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	const board = (await deckRequest(context, 'GET', `/boards/${boardId}`)) as DeckBoard;
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
