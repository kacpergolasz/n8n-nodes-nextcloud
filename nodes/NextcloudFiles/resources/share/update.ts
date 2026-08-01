import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildShareUpdateBody,
	ocsRequest,
	parseShare,
	validateSharePassword,
} from '../../GenericFunctions';
import {
	getErrorMessage,
	isPlainObject,
	parsePositiveInt,
	parseRequiredBoolean,
	parseString,
	parseStringArray,
} from '../../../shared/parse';
import type { ShareOperationContext } from './types';

const SHARE_UPDATE_FIELD_KEYS = new Set([
	'permissions',
	'password',
	'expireDate',
	'publicUpload',
]);

function parseShareUpdateFields(raw: unknown): {
	fieldsToUpdate: string[];
	permissions?: string[];
	password?: string;
	expireDate?: string;
	publicUpload?: boolean;
} {
	if (!isPlainObject(raw)) {
		throw new Error(
			'Select at least one field to update (permissions, password, expire date, or public upload)',
		);
	}

	const fieldsToUpdate = Object.keys(raw).filter((key) => SHARE_UPDATE_FIELD_KEYS.has(key));
	if (fieldsToUpdate.length === 0) {
		throw new Error(
			'Select at least one field to update (permissions, password, expire date, or public upload)',
		);
	}

	const result: {
		fieldsToUpdate: string[];
		permissions?: string[];
		password?: string;
		expireDate?: string;
		publicUpload?: boolean;
	} = { fieldsToUpdate };

	if ('permissions' in raw) {
		result.permissions = parseStringArray(raw.permissions, 'Permissions');
	}
	if ('password' in raw) {
		result.password = parseString(raw.password, 'Password');
	}
	if ('expireDate' in raw) {
		result.expireDate = parseString(raw.expireDate, 'Expire date');
	}
	if ('publicUpload' in raw) {
		result.publicUpload = parseRequiredBoolean(raw.publicUpload, 'Public upload');
	}

	return result;
}

export async function shareUpdate(
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

	const existingData = await ocsRequest(context, 'GET', `shares/${shareId}`);
	const existingShare = parseShare(existingData);

	let update: ReturnType<typeof parseShareUpdateFields>;
	try {
		update = parseShareUpdateFields(context.getNodeParameter('updateFields', itemIndex, {}));
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	let body: IDataObject;
	try {
		body = buildShareUpdateBody({
			fieldsToUpdate: update.fieldsToUpdate,
			permissions: update.permissions,
			password: update.password,
			expireDate: update.expireDate,
			publicUpload: update.publicUpload,
			shareType: existingShare.shareType,
		});
	} catch (error) {
		throw new NodeOperationError(context.getNode(), getErrorMessage(error), {
			itemIndex,
		});
	}

	if (
		update.fieldsToUpdate.includes('password') &&
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
