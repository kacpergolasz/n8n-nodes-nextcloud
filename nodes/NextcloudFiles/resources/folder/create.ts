import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { buildFilesUrl, nextcloudRequest } from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderCreate(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const folderUrl = buildFilesUrl(credentials.baseUrl, credentials.username, folderPath);
	await nextcloudRequest(context, 'MKCOL', folderUrl);
	return {
		json: { path: folderPath, created: true },
		pairedItem: { item: itemIndex },
	};
}
