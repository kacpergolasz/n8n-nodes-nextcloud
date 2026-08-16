import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient } from '../../GenericFunctions';
import { getBoard } from '../../repositories/DeckBoard.repository';
import { parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardGet(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const board = unwrapResult(
		await getBoard(await createDeckClient(context), {
			boardId: parseRequiredNumber(resolveBoardFromInput(context, itemIndex), 'Board'),
		}),
	);
	return {
		json: board,
		pairedItem: { item: itemIndex },
	};
}
