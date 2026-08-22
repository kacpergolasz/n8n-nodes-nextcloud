import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { renameFolder } from '../../repositories/NewsFolder.repository';
import { parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { folderToJson } from '../shared/entityJson';
import { resolveFolderFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderRename(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderId = resolveFolderFromInput(context, itemIndex);
	const name = parseRequiredString(context.getNodeParameter('name', itemIndex), 'Name');
	if (!name.trim()) {
		throw new NodeOperationError(context.getNode(), 'Name is required when renaming a folder', {
			itemIndex,
		});
	}

	const folder =
		unwrapResult(
			await renameFolder(await createNewsClient(context), {
				folderId: Number(folderId),
				name,
			}),
		) ?? { id: Number(folderId), name };

	return {
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	};
}
