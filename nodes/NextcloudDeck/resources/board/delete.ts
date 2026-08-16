import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createDeckClient } from '../../GenericFunctions';
import { deleteBoard } from '../../repositories/DeckBoard.repository';
import { parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardDelete(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	unwrapResult(
		await deleteBoard(await createDeckClient(context), {
			boardId: parseRequiredNumber(boardId, 'Board'),
		}),
	);
	return {
		json: { id: boardId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}