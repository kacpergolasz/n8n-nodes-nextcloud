import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { folderTransferPath } from './transferPath';
import type { FolderOperationContext } from './types';

export async function folderMove(
	context: IExecuteFunctions,
	ctx: FolderOperationContext,
): Promise<INodeExecutionData> {
	return folderTransferPath(context, ctx, 'MOVE');
}
