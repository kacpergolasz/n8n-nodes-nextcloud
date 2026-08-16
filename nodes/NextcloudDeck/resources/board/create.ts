import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createDeckClient, normalizeDeckColor } from '../../GenericFunctions';
import { createBoard } from '../../repositories/DeckBoard.repository';
import { parseRequiredString, parseString } from '../../../shared/parse';
import { unwrapResult } from '../../shared/apiResponseHelpers';
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
	const board = unwrapResult(
		await createBoard(await createDeckClient(context), {
			title,
			color: normalizeDeckColor(hexColor) || '0082c9',
		}),
	);
	return {
		json: board,
		pairedItem: { item: itemIndex },
	};
}