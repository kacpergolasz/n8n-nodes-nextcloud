import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildFilesUrl,
	contentTypeFromFileName,
	fileNameFromPath,
	nextcloudRequest,
	resolveUploadPath,
} from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileUpload(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const targetPath = resolvePathFromInput(context, itemIndex);
	const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const fileNameParam = context.getNodeParameter('fileName', itemIndex, '') as string;
	const inputItem = context.getInputData()[itemIndex];
	const binaryMeta = inputItem.binary?.[binaryPropertyName];
	const resolvedFileName =
		fileNameParam.trim() || binaryMeta?.fileName || `upload-${Date.now()}`;
	const uploadPath = resolveUploadPath(targetPath, resolvedFileName);
	const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const mimeType = binaryMeta?.mimeType ?? contentTypeFromFileName(resolvedFileName);
	const fileUrl = buildFilesUrl(credentials.baseUrl, credentials.username, uploadPath);

	await nextcloudRequest(context, 'PUT', fileUrl, buffer, {
		'Content-Type': mimeType,
	});

	return {
		json: {
			path: uploadPath,
			fileName: fileNameFromPath(uploadPath),
			uploaded: true,
		},
		pairedItem: { item: itemIndex },
	};
}
