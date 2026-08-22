import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { deleteFolder } from '../../repositories/NewsFolder.repository';
import { unwrapResult } from '../../../shared/apiResult';
import { resolveFolderFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderDelete(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderId = resolveFolderFromInput(context, itemIndex);
	unwrapResult(
		await deleteFolder(await createNewsClient(context), { folderId: Number(folderId) }),
	);

	return {
		json: { id: Number(folderId), deleted: true },
		pairedItem: { item: itemIndex },
	};
}
