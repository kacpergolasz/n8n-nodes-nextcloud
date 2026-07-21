import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ocsRequest } from '../../GenericFunctions';
import { getErrorMessage, parsePositiveInt } from '../../../shared/parse';
import type { ShareOperationContext } from './types';

export async function shareDelete(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	let shareId: number;
	try {
		shareId = parsePositiveInt(context.getNodeParameter('shareId', itemIndex), 'Share ID');
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	await ocsRequest(context, 'DELETE', `shares/${shareId}`);
	return {
		json: { shareId, deleted: true },
		pairedItem: { item: itemIndex },
	};
}
