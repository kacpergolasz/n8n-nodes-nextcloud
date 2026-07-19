import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { fileTransferPath } from './transferPath';
import type { FileOperationContext } from './types';

export async function fileMove(
	context: IExecuteFunctions,
	ctx: FileOperationContext,
): Promise<INodeExecutionData> {
	return fileTransferPath(context, ctx, 'MOVE');
}
