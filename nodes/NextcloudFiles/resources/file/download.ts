import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	contentTypeFromFileName,
	createFilesClient,
	fileNameFromPath,
} from '../../GenericFunctions';
import { downloadFile } from '../../repositories/FilesFile.repository';
import { parseBinaryBuffer, parseRequiredString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileDownload(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	const binaryPropertyName = parseRequiredString(
		context.getNodeParameter('binaryPropertyName', itemIndex),
		'Binary property',
	);
	const response = unwrapResult(
		await downloadFile(await createFilesClient(context), { sourcePath }),
	);
	const buffer = parseBinaryBuffer(response);
	const fileName = fileNameFromPath(sourcePath);
	const mimeType = contentTypeFromFileName(fileName);
	const binaryData = await context.helpers.prepareBinaryData(buffer, fileName, mimeType);

	return {
		json: {
			path: sourcePath,
			fileName,
			downloaded: true,
		},
		binary: {
			[binaryPropertyName]: binaryData,
		},
		pairedItem: { item: itemIndex },
	};
}
