import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient, normalizeFilesPath } from '../../GenericFunctions';
import { copyFile, moveFile } from '../../repositories/FilesFile.repository';
import { parseRequiredBoolean, parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileTransferPath(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
	method: 'MOVE' | 'COPY',
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	const destinationPath = normalizeFilesPath(
		parseRequiredString(context.getNodeParameter('destinationPath', itemIndex), 'Destination path'),
	);
	const overwrite = parseRequiredBoolean(
		context.getNodeParameter('overwrite', itemIndex, false),
		'Overwrite',
	);
	const client = await createFilesClient(context);
	const transfer = method === 'MOVE' ? moveFile : copyFile;
	unwrapResult(
		await transfer(client, {
			sourcePath,
			destinationPath,
			overwrite,
		}),
	);
	return {
		json: {
			path: sourcePath,
			destinationPath,
			[method === 'MOVE' ? 'moved' : 'copied']: true,
		},
		pairedItem: { item: itemIndex },
	};
}
