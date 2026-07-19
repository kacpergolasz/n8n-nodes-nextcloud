import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { buildFilesUrl, nextcloudRequest } from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileDelete(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	const fileUrl = buildFilesUrl(credentials.baseUrl, credentials.username, sourcePath);
	await nextcloudRequest(context, 'DELETE', fileUrl);
	return {
		json: { path: sourcePath, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
