import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { createNewsClient } from '../../GenericFunctions';
import { createFolder } from '../../repositories/NewsFolder.repository';
import { parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { folderToJson } from '../shared/entityJson';
import type { FolderOperationContext } from './types';

export async function folderCreate(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const name = parseRequiredString(context.getNodeParameter('name', itemIndex), 'Name');
	if (!name.trim()) {
		throw new NodeOperationError(context.getNode(), 'Name is required when creating a folder', {
			itemIndex,
		});
	}

	const folder = unwrapResult(
		await createFolder(await createNewsClient(context), { name }),
	);

	return {
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	};
}
