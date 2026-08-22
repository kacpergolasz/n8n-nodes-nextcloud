import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient } from '../../GenericFunctions';
import { createFolder } from '../../repositories/FilesFolder.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderCreate(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	unwrapResult(await createFolder(await createFilesClient(context), { folderPath }));
	return {
		json: { path: folderPath, created: true },
		pairedItem: { item: itemIndex },
	};
}
