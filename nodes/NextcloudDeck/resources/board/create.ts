import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { DeckBoard } from '../../DeckInterface';
import { deckRequest, normalizeDeckColor } from '../../GenericFunctions';
import { boardToJson } from '../shared/entityJson';
import type { BoardOperationContext } from './types';

export async function boardCreate(
	context: IExecuteFunctions,
	ctx: BoardOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const title = context.getNodeParameter('title', itemIndex) as string;
	const hexColor = context.getNodeParameter('hexColor', itemIndex, '') as string;
	if (!title.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Title is required when creating a board',
			{ itemIndex },
		);
	}
	const board = (await deckRequest(context, 'POST', '/boards', {
		title,
		color: normalizeDeckColor(hexColor) || '0082c9',
	})) as DeckBoard;
	return {
		json: boardToJson(board),
		pairedItem: { item: itemIndex },
	};
}
