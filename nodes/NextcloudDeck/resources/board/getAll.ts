import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { deckRequest, filterActiveBoards, parseDeckBoards } from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { boardToJson } from '../shared/entityJson';
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
	const boards = filterActiveBoards(parseDeckBoards(await deckRequest(context, 'GET', '/boards')));
	const sliced = returnAll ? boards : boards.slice(0, limit);
	return sliced.map((board) => ({
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	}));
}
