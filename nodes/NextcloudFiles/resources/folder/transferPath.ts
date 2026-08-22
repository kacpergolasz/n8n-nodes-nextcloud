import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient, normalizeFilesPath } from '../../GenericFunctions';
import { copyFolder, moveFolder } from '../../repositories/FilesFolder.repository';
import { parseRequiredBoolean, parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderTransferPath(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
	method: 'MOVE' | 'COPY',
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const destinationPath = normalizeFilesPath(
		parseRequiredString(context.getNodeParameter('destinationPath', itemIndex), 'Destination path'),
	);
	const overwrite = parseRequiredBoolean(
		context.getNodeParameter('overwrite', itemIndex, false),
		'Overwrite',
	);
	const client = await createFilesClient(context);
	const transfer = method === 'MOVE' ? moveFolder : copyFolder;
	unwrapResult(
		await transfer(client, {
			sourcePath: folderPath,
			destinationPath,
			overwrite,
		}),
	);
	return {
		json: {
			path: folderPath,
			destinationPath,
			[method === 'MOVE' ? 'moved' : 'copied']: true,
		},
		pairedItem: { item: itemIndex },
	};
}
