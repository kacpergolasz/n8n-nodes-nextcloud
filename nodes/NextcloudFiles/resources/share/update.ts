import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildShareUpdateBody,
	ocsRequest,
	parseShare,
	parseShareId,
	validateSharePassword,
} from '../../GenericFunctions';
import {
	getErrorMessage,
	parseRequiredBoolean,
	parseString,
	parseStringArray,
} from '../../../shared/parse';
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
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	const existingData = await ocsRequest(context, 'GET', `shares/${shareId}`);
	const existingShare = parseShare(existingData);

	const updateFields = parseStringArray(
		context.getNodeParameter('updateFields', itemIndex, []),
		'Update fields',
	);
	const updatePermissions = parseStringArray(
		context.getNodeParameter('updatePermissions', itemIndex, []),
		'Update permissions',
	);
	const password = parseString(context.getNodeParameter('password', itemIndex, ''), 'Password');
	const expireDate = parseString(context.getNodeParameter('expireDate', itemIndex, ''), 'Expire date');
	const publicUpload = parseRequiredBoolean(
		context.getNodeParameter('publicUpload', itemIndex, false),
		'Public upload',
	);

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
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
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
		json: share,
		pairedItem: { item: itemIndex },
	};
}
