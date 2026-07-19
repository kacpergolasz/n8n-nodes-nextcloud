import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { normalizeFilesPath, ocsRequest, parseShare } from '../../GenericFunctions';
import type { ShareOperationContext } from './types';

export async function shareGetAll(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const filterPath = context.getNodeParameter('filterPath', itemIndex, '') as string;
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = context.getNodeParameter('limit', itemIndex, 100) as number;
	const qs: IDataObject = {};
	if (filterPath.trim()) {
		qs.path = normalizeFilesPath(filterPath);
	}

	const data = await ocsRequest(context, 'GET', 'shares', undefined, qs);
	const rawShares = Array.isArray(data) ? data : data ? [data] : [];
	const shares = rawShares.map((entry) => parseShare(entry));
	const sliced = returnAll ? shares : shares.slice(0, limit);

	if (sliced.length === 0) {
		return [
			{
				json: { empty: true },
				pairedItem: { item: itemIndex },
			},
		];
	}

	return sliced.map((share) => ({
		json: share as unknown as IDataObject,
		pairedItem: { item: itemIndex },
	}));
}
