import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient } from '../../GenericFunctions';
import { listFolder } from '../../repositories/FilesFolder.repository';
import { parseRequiredBoolean, parseRequiredNumber } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderList(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return all',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 100), 'Limit');
	const entries = unwrapResult(
		await listFolder(await createFilesClient(context), { directoryPath: folderPath }),
	);
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
