import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildSharePermissionsBitmask,
	ocsRequest,
	parseShare,
	validateSharePassword,
} from '../../GenericFunctions';
import { resolvePathFromInput } from '../shared/resolveInput';
import type { ShareOperationContext } from './types';

export async function shareCreate(
	context: IExecuteFunctions,
	ctx: ShareOperationContext,
): Promise<INodeExecutionData> {
	const { itemIndex } = ctx;
	const sharePath = resolvePathFromInput(context, itemIndex);
	const shareType = context.getNodeParameter('shareType', itemIndex) as number;
	const shareWith = context.getNodeParameter('shareWith', itemIndex, '') as string;
	const permissionLabels = context.getNodeParameter('permissions', itemIndex) as string[];
	let permissions: number;
	try {
		permissions = buildSharePermissionsBitmask(permissionLabels, shareType);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), (error as Error).message, {
			itemIndex,
		});
	}
	const password = context.getNodeParameter('password', itemIndex, '') as string;
	const expireDate = context.getNodeParameter('expireDate', itemIndex, '') as string;
	const publicUpload = context.getNodeParameter('publicUpload', itemIndex, false) as boolean;
	const note = context.getNodeParameter('note', itemIndex, '') as string;

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
		json: share as unknown as IDataObject,
		pairedItem: { item: itemIndex },
	};
}
