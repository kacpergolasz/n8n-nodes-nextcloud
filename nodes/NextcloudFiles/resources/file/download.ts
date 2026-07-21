import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildFilesUrl,
	contentTypeFromFileName,
	fileNameFromPath,
	nextcloudRequest,
} from '../../GenericFunctions';
import { parseBinaryBuffer, parseRequiredString } from '../../../shared/parse';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileDownload(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	const binaryPropertyName = parseRequiredString(
		context.getNodeParameter('binaryPropertyName', itemIndex),
		'Binary property',
	);
	const fileUrl = buildFilesUrl(credentials.baseUrl, credentials.username, sourcePath);
	const response = await nextcloudRequest(
		context,
		'GET',
		fileUrl,
		undefined,
		{},
		{ encoding: 'arraybuffer' },
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
