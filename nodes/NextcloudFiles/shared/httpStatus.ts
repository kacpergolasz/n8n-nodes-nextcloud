function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

const STATUS_KEYS = ['statusCode', 'httpCode', 'status'] as const;

/**
 * Best-effort HTTP status extraction from n8n / request errors.
 */
export function getHttpStatusCode(error: unknown): number | undefined {
	if (!isRecord(error)) return undefined;

	for (const key of STATUS_KEYS) {
		const value = error[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
	}

	const response = error.response;
	if (isRecord(response)) {
		const nested = getHttpStatusCode(response);
		if (nested !== undefined) return nested;
	}

	if ('cause' in error) {
		return getHttpStatusCode(error.cause);
	}

	return undefined;
}

/**
 * Format user-facing Files errors.
 *
 * Nextcloud's OCS Share API reuses HTTP/OCS 404 for validation failures
 * (e.g. "Expiration date is in the past"). Prefer the scrubbed server message
 * when it is more specific than a bare not-found / transport 404 string.
 */
export function formatFilesErrorMessage(
	statusCode: number | undefined,
	scrubbedMessage: string,
): string {
	const trimmed = scrubbedMessage.trim();

	if (statusCode === 404) {
		if (
			!trimmed ||
			/^not found\.?$/i.test(trimmed) ||
			/^resource not found/i.test(trimmed) ||
			/the resource you are requesting could not be found/i.test(trimmed) ||
			/status code 404/i.test(trimmed) ||
			/^request failed/i.test(trimmed)
		) {
			return 'Resource not found (404)';
		}
		return trimmed;
	}

	return trimmed || 'Unknown error';
}
