import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { applyReturnAllLimit } from '../../../shared/pagination';
import { newsRequest, unwrapFolders } from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { folderToJson } from '../shared/entityJson';
import type { FolderOperationContext } from './types';

export async function folderGetAll(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = parseRequiredBoolean(context.getNodeParameter('returnAll', itemIndex, false), 'Return All');
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const folders = unwrapFolders(await newsRequest(context, 'GET', '/folders'));
	const limited = applyReturnAllLimit(folders, returnAll, limit);

	return limited.map((folder) => ({
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	}));
}
