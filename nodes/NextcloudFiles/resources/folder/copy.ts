import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { folderTransferPath } from './transferPath';
import type { FolderOperationContext } from './types';

export async function folderCopy(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	return folderTransferPath(context, ctx, 'COPY');
}
