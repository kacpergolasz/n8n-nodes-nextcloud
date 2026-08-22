import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { applyReturnAllLimit } from '../../../shared/pagination';
import { createNewsClient } from '../../GenericFunctions';
import { getFolders } from '../../repositories/NewsFolder.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { folderToJson } from '../shared/entityJson';
import type { FolderOperationContext } from './types';

export async function folderGetAll(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const returnAll = parseRequiredBoolean(context.getNodeParameter('returnAll', itemIndex, false), 'Return All');
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 10), 'Limit');
	const folders = unwrapResult(await getFolders(await createNewsClient(context)));
	const limited = applyReturnAllLimit(folders, returnAll, limit);

	return limited.map((folder) => ({
		json: folderToJson(folder),
		pairedItem: { item: itemIndex },
	}));
}
