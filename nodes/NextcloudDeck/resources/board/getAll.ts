import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckBoard } from '../../DeckInterface';
import { deckRequest, filterActiveBoards } from '../../GenericFunctions';
import { boardToJson } from '../shared/entityJson';
import type { BoardOperationContext } from './types';

export async function boardGetAll(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const boards = filterActiveBoards(
		(await deckRequest(context, 'GET', '/boards')) as DeckBoard[],
	);
	const sliced = returnAll ? boards : boards.slice(0, limit);
	return sliced.map((board) => ({
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	}));
}
