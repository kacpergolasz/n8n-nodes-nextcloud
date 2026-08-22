import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient, filterActiveBoards } from '../../GenericFunctions';
import { getBoards } from '../../repositories/DeckBoard.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import type { BoardOperationContext } from './types';

export async function boardGetAll(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return All',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const boards = filterActiveBoards(
		unwrapResult(await getBoards(await createDeckClient(context))),
	);
	const sliced = returnAll ? boards : boards.slice(0, limit);
	return sliced.map((board) => ({
		json: board,
		pairedItem: { item: itemIndex },
	}));
}
