import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { deckRequest, normalizeDeckColor, parseDeckBoard } from '../../GenericFunctions';
import { parseRequiredString, parseString } from '../../../shared/parse';
import { boardToJson } from '../shared/entityJson';
import type { BoardOperationContext } from './types';

export async function boardCreate(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const title = parseRequiredString(context.getNodeParameter('title', itemIndex), 'Title');
	const hexColor = parseString(context.getNodeParameter('hexColor', itemIndex, ''), 'Hex color');
	if (!title.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Title is required when creating a board',
			{ itemIndex },
		);
	}
	const board = parseDeckBoard(
		await deckRequest(context, 'POST', '/boards', {
			title,
			color: normalizeDeckColor(hexColor) || '0082c9',
		}),
	);
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
