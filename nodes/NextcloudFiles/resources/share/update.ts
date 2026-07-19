import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildShareUpdateBody,
	ocsRequest,
	parseShare,
	parseShareId,
	validateSharePassword,
} from '../../GenericFunctions';
import type { ShareOperationContext } from './types';

export async function shareUpdate(
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

	const existingData = await ocsRequest(context, 'GET', `shares/${shareId}`);
	const existingShare = parseShare(existingData);

	const updateFields = context.getNodeParameter('updateFields', itemIndex, []) as string[];
	const updatePermissions = context.getNodeParameter('updatePermissions', itemIndex, []) as string[];
	const password = context.getNodeParameter('password', itemIndex, '') as string;
	const expireDate = context.getNodeParameter('expireDate', itemIndex, '') as string;
	const publicUpload = context.getNodeParameter('publicUpload', itemIndex, false) as boolean;

	let body: IDataObject;
	try {
		body = buildShareUpdateBody({
			fieldsToUpdate: updateFields,
			permissions: updatePermissions,
			password,
			expireDate,
			publicUpload,
			shareType: existingShare.shareType,
		});
	} catch (error) {
		throw new NodeOperationError(context.getNode(), (error as Error).message, {
			itemIndex,
		});
	}

	if (
		updateFields.includes('password') &&
		typeof body.password === 'string' &&
		body.password.length > 0
	) {
		const passwordPolicyError = await validateSharePassword(context, body.password);
		if (passwordPolicyError) {
			throw new NodeOperationError(context.getNode(), passwordPolicyError, {
				itemIndex,
			});
		}
	}

	const data = await ocsRequest(context, 'PUT', `shares/${shareId}`, body);
	const share = parseShare(data);
	return {
		json: share as unknown as IDataObject,
		pairedItem: { item: itemIndex },
	};
}
