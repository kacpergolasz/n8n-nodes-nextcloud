import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { createFilesClient, normalizeFilesPath } from '../../GenericFunctions';
import { listShares } from '../../repositories/FilesShare.repository';
import {
	parseRequiredBoolean,
	parseRequiredNumber,
	parseString,
} from '../../../shared/parse';
import { unwrapResult } from '../../../shared/apiResult';
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
	const shares = unwrapResult(
		await listShares(await createFilesClient(context), {
			path: filterPath.trim() ? normalizeFilesPath(filterPath) : undefined,
		}),
	);
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
