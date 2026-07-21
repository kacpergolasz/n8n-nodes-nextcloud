import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildDestinationHeader,
	buildFilesUrl,
	buildOverwriteHeader,
	nextcloudRequest,
	normalizeFilesPath,
} from '../../GenericFunctions';
import { parseRequiredBoolean, parseRequiredString } from '../../../shared/parse';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { FileOperationContext } from './types';

export async function fileTransferPath(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
	method: 'MOVE' | 'COPY',
): Promise<INodeExecutionData> {
	const { itemIndex, credentials } = ctx;
	const sourcePath = resolvePathFromInput(context, itemIndex);
	const destinationPath = normalizeFilesPath(
		parseRequiredString(context.getNodeParameter('destinationPath', itemIndex), 'Destination path'),
	);
	const overwrite = parseRequiredBoolean(
		context.getNodeParameter('overwrite', itemIndex, false),
		'Overwrite',
	);
	const sourceUrl = buildFilesUrl(credentials.baseUrl, credentials.username, sourcePath);
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
			path: sourcePath,
			destinationPath,
			[method === 'MOVE' ? 'moved' : 'copied']: true,
		},
		pairedItem: { item: itemIndex },
	};
}
