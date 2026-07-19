import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	nextcloudRequest,
	normalizeFilesPath,
} from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FolderOperationContext } from './types';

export async function folderTransferPath(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
	method: 'MOVE' | 'COPY',
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const folderPath = resolvePathFromInput(context, itemIndex);
	const destinationPath = normalizeFilesPath(
		context.getNodeParameter('destinationPath', itemIndex) as string,
	);
	const overwrite = context.getNodeParameter('overwrite', itemIndex, false) as boolean;
	const sourceUrl = buildFilesUrl(credentials.baseUrl, credentials.username, folderPath);
	await nextcloudRequest(context, method, sourceUrl, undefined, {
		Destination: buildDestinationHeader(
			credentials.baseUrl,
			credentials.username,
			destinationPath,
		),
		Overwrite: buildOverwriteHeader(overwrite),
	});
	return {
		json: {
			path: folderPath,
			destinationPath,
			[method === 'MOVE' ? 'moved' : 'copied']: true,
		},
		pairedItem: { item: itemIndex },
	};
}
