import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildBoardUpdatePayload,
	createDeckClient,
	normalizeDeckColor,
	parseBoardAdditionalFields,
	type BoardUpdatePatch,
} from '../../GenericFunctions';
import { getBoard, updateBoard } from '../../repositories/DeckBoard.repository';
import { parseRequiredNumber, parseString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardUpdate(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = parseRequiredNumber(resolveBoardFromInput(context, itemIndex), 'Board');
	const client = await createDeckClient(context);
	const current = unwrapResult(await getBoard(client, { boardId }));
	const title = parseString(context.getNodeParameter('title', itemIndex, ''), 'Title');
	const hexColor = parseString(context.getNodeParameter('hexColor', itemIndex, ''), 'Hex color');
	const additionalFields = parseBoardAdditionalFields(
		context.getNodeParameter('additionalFields', itemIndex, {}),
	);

	const patch: BoardUpdatePatch = {};
	if (title.trim()) {
		patch.title = title;
	}
	if (hexColor.trim()) {
		patch.color = normalizeDeckColor(hexColor);
	}
	if (typeof additionalFields.archived === 'boolean') {
		patch.archived = additionalFields.archived;
	}

	const board = unwrapResult(
		await updateBoard(client, { boardId, ...buildBoardUpdatePayload(current, patch) }),
	);
	return {
		json: board,
		pairedItem: { item: itemIndex },
	};
}
