import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { newsRequest } from '../../GenericFunctions';
import { resolveFolderFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderDelete(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderId = resolveFolderFromInput(context, itemIndex);
	await newsRequest(context, 'DELETE', `/folders/${folderId}`);

	return {
		json: { id: Number(folderId), deleted: true },
		pairedItem: { item: itemIndex },
	};
}
