import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { firstFolder, newsRequest } from '../../GenericFunctions';
import { folderToJson } from '../shared/entityJson';
import type { FolderOperationContext } from './types';

export async function folderCreate(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const name = context.getNodeParameter('name', itemIndex) as string;
	if (!name.trim()) {
		throw new NodeOperationError(context.getNode(), 'Name is required when creating a folder', {
			itemIndex,
		});
	}

	const response = await newsRequest(context, 'POST', '/folders', { body: { name } });
	const folder = firstFolder(response);
	if (!folder) {
		throw new NodeOperationError(context.getNode(), 'Folder create returned an empty response', {
			itemIndex,
		});
	}

	return {
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	};
}
