import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { DeckBoard } from '../../DeckInterface';
import { buildBoardUpdatePayload, deckRequest } from '../../GenericFunctions';
import { boardToJson } from '../shared/entityJson';
import { resolveBoardFromInput } from '../shared/resolveInput';
import type { BoardOperationContext } from './types';

export async function boardUpdate(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const boardId = resolveBoardFromInput(context, itemIndex);
	const current = (await deckRequest(context, 'GET', `/boards/${boardId}`)) as DeckBoard;
	const title = context.getNodeParameter('title', itemIndex, '') as string;
	const hexColor = context.getNodeParameter('hexColor', itemIndex, '') as string;
	const additionalFields = context.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

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
	const board = (await deckRequest(context, 'PUT', `/boards/${boardId}`, payload)) as DeckBoard;
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
