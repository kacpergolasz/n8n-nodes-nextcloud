import type { JsonObject } from 'n8n-workflow';
import { z } from 'zod';

/** Map Zod failures (and plain Errors) to a thrown Error with a user-facing message. */
export function throwParseError(error: unknown, fallbackMessage: string): never {
	if (error instanceof z.ZodError) {
		const first = error.issues[0];
		throw new Error(first?.message ?? fallbackMessage);
	}

	if (error instanceof Error) {
		throw error;
	}

	throw new Error(fallbackMessage);
}

export function parseRequiredString(value: unknown, label = 'Value'): string {
	if (value === undefined || value === null || value === '') {
		throw new Error(`${label} is required`);
	}

	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	throw new Error(`${label} must be a string`);
}

export function parseRequiredBoolean(value: unknown, label = 'Value'): boolean {
	if (value === undefined || value === null || value === '') {
		throw new Error(`${label} is required`);
	}

	if (typeof value === 'boolean') {
		return value;
	}

	if (value === 'true' || value === '1' || value === 1) {
		return true;
	}

	if (value === 'false' || value === '0' || value === 0) {
		return false;
	}

	throw new Error(`${label} must be a boolean`);
}

export function parseRequiredNumber(value: unknown, label = 'Value'): number {
	if (value === undefined || value === null || value === '') {
		throw new Error(`${label} is required`);
	}

	const parsed = typeof value === 'number' ? value : Number(String(value).trim());
	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} must be a number`);
	}

	return parsed;
}

/** Positive finite integer (e.g. share / board / feed ids). */
export function parsePositiveInt(value: unknown, label = 'Value'): number {
	if (value === undefined || value === null || value === '') {
		throw new Error(`${label} is required`);
	}

	const parsed = typeof value === 'number' ? value : Number(String(value).trim());
	if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
		throw new Error(`${label} must be a positive integer`);
	}

	return parsed;
}

/**
 * Basic-auth Nextcloud API credential bag (`nextcloudApi`).
 * Calendar OAuth assembly stays node-local until that phase adopts shared helpers.
 */
export const nextcloudCredentialSchema = z.object({
	baseUrl: z.string().min(1, 'Base URL is required'),
	username: z.string().min(1, 'Username is required'),
	appPassword: z.string().min(1, 'App password is required'),
});

export type NextcloudCredentialData = z.infer<typeof nextcloudCredentialSchema>;

export function parseNextcloudCredentials(raw: unknown): NextcloudCredentialData {
	try {
		return nextcloudCredentialSchema.parse(raw);
	} catch (error) {
		throwParseError(error, 'Invalid Nextcloud credentials');
	}
}

const nodeApiErrorPayloadSchema = z.object({
	message: z.string(),
	httpCode: z.union([z.string(), z.number()]).optional(),
});

export type NodeApiErrorPayload = z.infer<typeof nodeApiErrorPayloadSchema>;

/**
 * Build a `NodeApiError` error-object payload assignable to `JsonObject` without casts.
 */
export function nodeApiErrorPayload(
	message: string,
	extras?: { httpCode?: number | string },
): JsonObject {
	const payload: NodeApiErrorPayload = nodeApiErrorPayloadSchema.parse({
		message,
		...(extras?.httpCode !== undefined ? { httpCode: extras.httpCode } : {}),
	});
	return payload;
}
