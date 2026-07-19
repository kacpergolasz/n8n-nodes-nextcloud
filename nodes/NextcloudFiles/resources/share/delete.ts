import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ocsRequest, parseShareId } from '../../GenericFunctions';
import type { ShareOperationContext } from './types';

export async function shareDelete(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	let shareId: number;
	try {
		shareId = parseShareId(context.getNodeParameter('shareId', itemIndex));
	} catch (error) {
		throw new NodeOperationError(context.getNode(), (error as Error).message, {
			itemIndex,
		});
	}

	await ocsRequest(context, 'DELETE', `shares/${shareId}`);
	return {
		json: { shareId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
