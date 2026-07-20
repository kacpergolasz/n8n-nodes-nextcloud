import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { firstFolder, newsRequest } from '../../GenericFunctions';
import { folderToJson } from '../shared/entityJson';
import { resolveFolderFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderRename(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderId = resolveFolderFromInput(context, itemIndex);
	const name = context.getNodeParameter('name', itemIndex) as string;
	if (!name.trim()) {
		throw new NodeOperationError(context.getNode(), 'Name is required when renaming a folder', {
			itemIndex,
		});
	}

	const response = await newsRequest(context, 'PUT', `/folders/${folderId}`, {
		body: { name },
	});
	const folder = firstFolder(response) ?? { id: Number(folderId), name };

	return {
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	};
}
