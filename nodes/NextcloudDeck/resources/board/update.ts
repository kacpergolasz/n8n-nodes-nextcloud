import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildBoardUpdatePayload,
	deckRequest,
	parseBoardAdditionalFields,
	parseDeckBoard,
} from '../../GenericFunctions';
import { parseString } from '../../../shared/parse';
import { boardToJson } from '../shared/entityJson';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardUpdate(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	const current = parseDeckBoard(await deckRequest(context, 'GET', `/boards/${boardId}`));
	const title = parseString(context.getNodeParameter('title', itemIndex, ''), 'Title');
	const hexColor = parseString(context.getNodeParameter('hexColor', itemIndex, ''), 'Hex color');
	const additionalFields = parseBoardAdditionalFields(
		context.getNodeParameter('additionalFields', itemIndex, {}),
	);

	const patch: {
		title?: string;
		color?: string;
		archived?: boolean;
	} = {};
	if (title.trim()) {
		patch.title = title;
	}
	if (hexColor.trim()) {
		patch.color = hexColor;
	}
	if (typeof additionalFields.archived === 'boolean') {
		patch.archived = additionalFields.archived;
	}

	const payload = buildBoardUpdatePayload(current, patch);
	const board = parseDeckBoard(await deckRequest(context, 'PUT', `/boards/${boardId}`, payload));
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
