import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { applyReturnAllLimit } from '../../../shared/pagination';
import { newsRequest, unwrapFolders } from '../../GenericFunctions';
import { folderToJson } from '../shared/entityJson';
import type { FolderOperationContext } from './types';

export async function folderGetAll(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 10) as number;
	const folders = unwrapFolders(await newsRequest(context, 'GET', '/folders'));
	const limited = applyReturnAllLimit(folders, returnAll, limit);

	return limited.map((folder) => ({
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	}));
}
