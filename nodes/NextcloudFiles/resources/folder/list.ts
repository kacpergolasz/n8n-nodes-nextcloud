import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { loadDirectoryListing } from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderList(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, credentials } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 100) as number;
	const entries = await loadDirectoryListing(context, credentials, folderPath);
	const sliced = returnAll ? entries : entries.slice(0, limit);

	if (sliced.length === 0) {
		return [
			{
				json: { path: folderPath, empty: true },
				pairedItem: { item: itemIndex },
			},
		];
	}

	return sliced.map((entry) => ({
		json: entry as unknown as IDataObject,
		pairedItem: { item: itemIndex },
	}));
}
