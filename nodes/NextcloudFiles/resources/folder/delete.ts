import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient } from '../../GenericFunctions';
import { deleteFolder } from '../../repositories/FilesFolder.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderDelete(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	unwrapResult(await deleteFolder(await createFilesClient(context), { folderPath }));
	return {
		json: { path: folderPath, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
