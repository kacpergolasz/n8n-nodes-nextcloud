import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { loadDirectoryListing } from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderList(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex, credentials } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return all',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 100), 'Limit');
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
		json: entry,
		pairedItem: { item: itemIndex },
	}));
}
