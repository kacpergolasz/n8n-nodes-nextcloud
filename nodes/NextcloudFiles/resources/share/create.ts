import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildSharePermissionsBitmask,
	ocsRequest,
	parseShare,
	validateSharePassword,
} from '../../GenericFunctions';
import {
	getErrorMessage,
	parseRequiredBoolean,
	parseRequiredNumber,
	parseString,
	parseStringArray,
} from '../../../shared/parse';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { ShareOperationContext } from './types';

export async function shareCreate(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const sharePath = resolvePathFromInput(context, itemIndex);
	const shareType = parseRequiredNumber(context.getNodeParameter('shareType', itemIndex), 'Share type');
	const shareWith = parseString(context.getNodeParameter('shareWith', itemIndex, ''), 'Share with');
	const permissionLabels = parseStringArray(
		context.getNodeParameter('permissions', itemIndex),
		'Permissions',
	);
	let permissions: number;
	try {
		permissions = buildSharePermissionsBitmask(permissionLabels, shareType);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}
	const password = parseString(context.getNodeParameter('password', itemIndex, ''), 'Password');
	const expireDate = parseString(context.getNodeParameter('expireDate', itemIndex, ''), 'Expire date');
	const publicUpload = parseRequiredBoolean(
		context.getNodeParameter('publicUpload', itemIndex, false),
		'Public upload',
	);
	const note = parseString(context.getNodeParameter('note', itemIndex, ''), 'Note');

	const body: IDataObject = {
		path: sharePath,
		shareType,
		permissions,
	};
	if (shareWith.trim()) body.shareWith = shareWith.trim();
	if (password.trim()) {
		const passwordPolicyError = await validateSharePassword(context, password);
		if (passwordPolicyError) {
			throw new NodeOperationError(context.getNode(), passwordPolicyError, {
				itemIndex,
			});
		}
		body.password = password.trim();
	}
	if (expireDate.trim()) body.expireDate = expireDate.trim();
	if (publicUpload) body.publicUpload = 'true';
	if (note.trim()) body.note = note.trim();

	const data = await ocsRequest(context, 'POST', 'shares', body);
	const share = parseShare(data);
	return {
		json: share,
		pairedItem: { item: itemIndex },
	};
}
