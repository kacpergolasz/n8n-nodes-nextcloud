import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	contentTypeFromFileName,
	createFilesClient,
	fileNameFromPath,
	resolveUploadPath,
} from '../../GenericFunctions';
import { uploadFile } from '../../repositories/FilesFile.repository';
import { parseRequiredString, parseString } from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileUpload(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const targetPath = resolvePathFromInput(context, itemIndex);
	const binaryPropertyName = parseRequiredString(
		context.getNodeParameter('binaryPropertyName', itemIndex),
		'Binary property',
	);
	const fileNameParam = parseString(context.getNodeParameter('fileName', itemIndex, ''), 'File name');
	const inputItem = context.getInputData()[itemIndex];
	const binaryMeta = inputItem.binary?.[binaryPropertyName];
	const resolvedFileName =
		fileNameParam.trim() || binaryMeta?.fileName || `upload-${Date.now()}`;
	const uploadPath = resolveUploadPath(targetPath, resolvedFileName);
	const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
	const mimeType = binaryMeta?.mimeType ?? contentTypeFromFileName(resolvedFileName);

	unwrapResult(
		await uploadFile(await createFilesClient(context), {
			uploadPath,
			body: buffer,
			contentType: mimeType,
		}),
	);

	return {
		json: {
			path: uploadPath,
			fileName: fileNameFromPath(uploadPath),
			uploaded: true,
		},
		pairedItem: { item: itemIndex },
	};
}
