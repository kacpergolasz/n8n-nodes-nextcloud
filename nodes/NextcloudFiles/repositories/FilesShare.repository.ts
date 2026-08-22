/**
 * Repository for Nextcloud OCS files_sharing shares + password_policy validate.
 *
 * Reference: nodes/NextcloudFiles/context/api/documentation/openapi.md
 */
import type { IDataObject } from 'n8n-workflow';
import { z } from 'zod';

import type { ParsedShare } from '../FilesInterface';
import type { FilesClient } from '../files.client';
import { isPlainObject } from '../../shared/parse';
import { parseEmpty, type Maybe } from '../../shared/apiResult';
import { getHttpStatusCode } from '../shared/httpStatus';

const OCS_SHARES_BASE = '/ocs/v2.php/apps/files_sharing/api/v1';
/** OCS path for the password_policy validate endpoint (not a credential). */
const OCS_POLICY_VALIDATE_PATH = '/ocs/v2.php/apps/password_policy/api/v1/validate';

const ocsMetaSchema = z.object({
	status: z.string(),
	statuscode: z.number(),
	message: z.union([z.string(), z.null()]).optional(),
});

const ocsPasswordValidationDataSchema = z.object({
	passed: z.boolean().optional(),
	reason: z.string().optional(),
});

export class OcsRequestError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = 'OcsRequestError';
		this.statusCode = statusCode;
	}
}

export function buildOcsFormBody(body?: IDataObject): string | undefined {
	if (!body) return undefined;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(body)) {
		if (value === undefined || value === null) continue;
		params.set(key, String(value));
	}
	return params.toString();
}

function asString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	const text = String(value).trim();
	return text || undefined;
}

function asNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'boolean') return value;
	const normalized = String(value).toLowerCase();
	if (normalized === 'true' || normalized === '1') return true;
	if (normalized === 'false' || normalized === '0') return false;
	return undefined;
}

/** Normalize OCS share payloads that may be a single object or a one-element array (GET by ID). */
export function normalizeOcsSharePayload(data: unknown): Record<string, unknown> {
	if (Array.isArray(data)) {
		if (data.length === 0) {
			throw new Error('Invalid OCS share payload');
		}
		const first = data[0];
		if (isPlainObject(first)) {
			return first;
		}
		throw new Error('Invalid OCS share payload');
	}

	if (isPlainObject(data)) {
		return data;
	}

	throw new Error('Invalid OCS share payload');
}

export const parsedShareSchema = z.object({
	id: z.number(),
	shareType: z.number(),
	path: z.string(),
	permissions: z.number(),
	shareWith: z.string().optional(),
	url: z.string().optional(),
	token: z.string().optional(),
	expiration: z.string().optional(),
	note: z.string().optional(),
	publicUpload: z.boolean().optional(),
	uidOwner: z.string().optional(),
	displaynameOwner: z.string().optional(),
	itemType: z.string().optional(),
	mimetype: z.string().optional(),
});

/** Normalize a single OCS share payload into a stable workflow shape. */
export function parseShare(data: unknown): ParsedShare {
	const share = normalizeOcsSharePayload(data);
	const id = asNumber(share.id);
	const shareType = asNumber(share.share_type ?? share.shareType);
	const path = asString(share.path) ?? asString(share.file_target);

	if (id === undefined || shareType === undefined || !path) {
		throw new Error('Invalid OCS share payload');
	}

	const permissions = asNumber(share.permissions) ?? 0;

	return parsedShareSchema.parse({
		id,
		shareType,
		path,
		permissions,
		shareWith: asString(share.share_with ?? share.shareWith),
		url: asString(share.url),
		token: asString(share.token),
		expiration: asString(share.expiration ?? share.expire_date ?? share.expireDate),
		note: asString(share.note),
		publicUpload: asBoolean(share.public_upload ?? share.publicUpload),
		uidOwner: asString(share.uid_owner ?? share.uidOwner),
		displaynameOwner: asString(share.displayname_owner ?? share.displaynameOwner),
		itemType: asString(share.item_type ?? share.itemType),
		mimetype: asString(share.mimetype),
	});
}

export function unwrapOcsResponse(response: unknown): unknown {
	if (!isPlainObject(response) || !isPlainObject(response.ocs)) {
		throw new Error('Invalid OCS response envelope');
	}

	const meta = ocsMetaSchema.parse(response.ocs.meta);
	const statusCode = meta.statuscode;
	const message = meta.message;

	if (statusCode !== 100 && statusCode !== 200) {
		throw new OcsRequestError(
			message?.trim() || `OCS request failed with status ${statusCode}`,
			statusCode,
		);
	}

	return response.ocs.data;
}

function unwrapOcsResult(result: Maybe<unknown>): Maybe<unknown> {
	if (!result.success) {
		return result;
	}
	try {
		return { success: true, response: unwrapOcsResponse(result.response) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

function parseShareResult(data: unknown): Maybe<ParsedShare> {
	try {
		return { success: true, response: parseShare(data) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

const ocsJsonHeaders = {
	'OCS-APIRequest': 'true',
	Accept: 'application/json',
};

const ocsFormHeaders = {
	...ocsJsonHeaders,
	'Content-Type': 'application/x-www-form-urlencoded',
};

export type ListSharesOptions = {
	path?: string;
};

export async function listShares(
	client: FilesClient,
	options: ListSharesOptions = {},
): Promise<Maybe<ParsedShare[]>> {
	const query: Record<string, string> = { format: 'json' };
	if (options.path?.trim()) {
		query.path = options.path.trim();
	}

	const unwrapped = unwrapOcsResult(
		await client.get(`${OCS_SHARES_BASE}/shares`, query, ocsJsonHeaders, {
			json: true,
			ignoreHttpStatusErrors: true,
		}),
	);
	if (!unwrapped.success) {
		return unwrapped;
	}

	const rawShares = Array.isArray(unwrapped.response)
		? unwrapped.response
		: unwrapped.response
			? [unwrapped.response]
			: [];

	try {
		return { success: true, response: rawShares.map((entry) => parseShare(entry)) };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

export type GetShareOptions = {
	shareId: number;
};

export async function getShare(
	client: FilesClient,
	options: GetShareOptions,
): Promise<Maybe<ParsedShare>> {
	const unwrapped = unwrapOcsResult(
		await client.get(
			`${OCS_SHARES_BASE}/shares/${options.shareId}`,
			{ format: 'json' },
			ocsJsonHeaders,
			{ json: true, ignoreHttpStatusErrors: true },
		),
	);
	if (!unwrapped.success) {
		return unwrapped;
	}
	return parseShareResult(unwrapped.response);
}

export type CreateShareOptions = {
	body: IDataObject;
};

export async function createShare(
	client: FilesClient,
	options: CreateShareOptions,
): Promise<Maybe<ParsedShare>> {
	const formBody = buildOcsFormBody(options.body);
	const unwrapped = unwrapOcsResult(
		await client.post(
			`${OCS_SHARES_BASE}/shares`,
			formBody,
			{ format: 'json' },
			ocsFormHeaders,
			{ json: true, ignoreHttpStatusErrors: true },
		),
	);
	if (!unwrapped.success) {
		return unwrapped;
	}
	return parseShareResult(unwrapped.response);
}

export type UpdateShareOptions = {
	shareId: number;
	body: IDataObject;
};

export async function updateShare(
	client: FilesClient,
	options: UpdateShareOptions,
): Promise<Maybe<ParsedShare>> {
	const formBody = buildOcsFormBody(options.body);
	const unwrapped = unwrapOcsResult(
		await client.put(
			`${OCS_SHARES_BASE}/shares/${options.shareId}`,
			formBody,
			{ format: 'json' },
			ocsFormHeaders,
			{ json: true, ignoreHttpStatusErrors: true },
		),
	);
	if (!unwrapped.success) {
		return unwrapped;
	}
	return parseShareResult(unwrapped.response);
}

export type DeleteShareOptions = {
	shareId: number;
};

export async function deleteShare(
	client: FilesClient,
	options: DeleteShareOptions,
): Promise<Maybe<null>> {
	const unwrapped = unwrapOcsResult(
		await client.delete(
			`${OCS_SHARES_BASE}/shares/${options.shareId}`,
			{ format: 'json' },
			ocsJsonHeaders,
			{ json: true, ignoreHttpStatusErrors: true },
		),
	);
	if (!unwrapped.success) {
		return unwrapped;
	}
	return parseEmpty({ success: true, response: unwrapped.response ?? undefined });
}

/** Parse the password_policy validate response; returns an error message when validation fails. */
export function parseSharePasswordValidationResult(response: unknown): string | undefined {
	if (!isPlainObject(response) || !isPlainObject(response.ocs)) {
		return undefined;
	}

	const metaParsed = ocsMetaSchema.safeParse(response.ocs.meta);
	if (!metaParsed.success) {
		return undefined;
	}

	const { statuscode, message } = metaParsed.data;
	if (statuscode !== 100 && statuscode !== 200) {
		return message?.trim() || `Password policy request failed with status ${statuscode}`;
	}

	const validation = ocsPasswordValidationDataSchema.safeParse(response.ocs.data);
	if (validation.success && validation.data.passed === false) {
		return (
			validation.data.reason?.trim() ||
			'Password does not meet the server password policy for public link shares'
		);
	}

	return undefined;
}

/**
 * Validate a share password against the Nextcloud password_policy app (sharing context).
 * Returns an error message when validation fails or the policy endpoint is unreachable
 * (transport / 5xx / unknown). Returns undefined when the password is accepted, or when
 * the password_policy app appears missing (HTTP 404/405/501 — fail open).
 */
export async function validateSharePasswordWithClient(
	client: FilesClient,
	password: string,
): Promise<string | undefined> {
	const trimmed = password.trim();
	if (!trimmed) return undefined;

	const result = await client.post(
		OCS_POLICY_VALIDATE_PATH,
		{ password: trimmed, context: 'sharing' },
		{ format: 'json' },
		{
			'OCS-APIRequest': 'true',
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		{ json: true },
	);

	if (!result.success) {
		const status = getHttpStatusCode(result.error);
		if (status === 404 || status === 405 || status === 501) {
			return undefined;
		}
		const detail = status !== undefined ? ` (HTTP ${status})` : '';
		return (
			`Could not validate share password against the server password policy${detail}. ` +
			'Retry later, or confirm the password_policy app is reachable.'
		);
	}

	return parseSharePasswordValidationResult(result.response);
}
