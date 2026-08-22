import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient } from '../../GenericFunctions';
import { deleteFile } from '../../repositories/FilesFile.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileDelete(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	unwrapResult(await deleteFile(await createFilesClient(context), { sourcePath }));
	return {
		json: { path: sourcePath, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
