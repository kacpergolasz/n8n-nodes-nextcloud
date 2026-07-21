import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { normalizeFilesPath, ocsRequest, parseShare } from '../../GenericFunctions';
import {
	parseRequiredBoolean,
	parseRequiredNumber,
	parseString,
} from '../../../shared/parse';
import type { ShareOperationContext } from './types';

export async function shareGetAll(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData[]> {
	const { itemIndex } = ctx;
	const filterPath = parseString(context.getNodeParameter('filterPath', itemIndex, ''), 'Filter path');
	const returnAll = parseRequiredBoolean(
		context.getNodeParameter('returnAll', itemIndex, false),
		'Return all',
	);
	const limit = parseRequiredNumber(context.getNodeParameter('limit', itemIndex, 100), 'Limit');
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
		json: share,
		pairedItem: { item: itemIndex },
	}));
}
