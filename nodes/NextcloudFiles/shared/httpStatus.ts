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

/** True when the message only restates the HTTP status (axios / client noise). */
export function isGenericHttpStatusMessage(
	message: string,
	statusCode?: number,
): boolean {
	const trimmed = message.trim();
	if (!trimmed) return true;

	if (/^request failed with status code \d{3}\.?$/i.test(trimmed)) return true;
	if (/^precondition failed\.?$/i.test(trimmed)) return true;

	if (statusCode !== undefined) {
		const escaped = String(statusCode);
		if (
			new RegExp(
				`^Files API request failed: ${escaped}(?:\\s*[—-]\\s*Request failed with status code ${escaped})?\\.?$`,
				'i',
			).test(trimmed)
		) {
			return true;
		}
		if (new RegExp(`^Files API request failed: ${escaped}\\.?$`, 'i').test(trimmed)) {
			return true;
		}
	}

	return false;
}

/**
 * Format user-facing Files errors.
 *
 * Nextcloud's OCS Share API reuses HTTP/OCS 404 for validation failures
 * (e.g. "Expiration date is in the past"). Prefer the scrubbed server message
 * when it is more specific than a bare not-found / transport 404 string.
 *
 * WebDAV COPY/MOVE returns 412 when the destination exists and Overwrite is F.
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

	if (statusCode === 412) {
		// Always use the overwrite hint — client messages still include "412" and n8n's
		// NodeApiError remaps unknown 4xx httpCodes to a useless generic string.
		return (
			'Destination already exists (412). Enable Overwrite, or choose a different destination path.'
		);
	}

	return trimmed || 'Unknown error';
}

/**
 * n8n `NodeApiError` replaces the message with a generic 4XX/5XX string whenever
 * `httpCode` is set and `message` is missing — and some UI paths still prefer the
 * status-code default for codes outside the specific map (e.g. 412 → 4XX generic).
 * Only forward httpCodes that have a dedicated entry in n8n's STATUS_CODE_MESSAGES.
 */
const N8N_SPECIFIC_HTTP_CODES = new Set([
	400, 401, 402, 403, 404, 405, 429, 500, 502, 503, 504,
]);

export function httpCodeForNodeApiError(
	statusCode: number | undefined,
): string | undefined {
	if (statusCode === undefined) return undefined;
	if (!N8N_SPECIFIC_HTTP_CODES.has(statusCode)) return undefined;
	return String(statusCode);
}
