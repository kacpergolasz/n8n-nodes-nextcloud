/**
 * Best-effort HTTP status extraction from n8n / request errors.
 */
export function getHttpStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;

	const record = error as Record<string, unknown>;

	for (const key of ['statusCode', 'httpCode', 'status'] as const) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
	}

	const response = record.response;
	if (response && typeof response === 'object') {
		const nested = getHttpStatusCode(response);
		if (nested !== undefined) return nested;
	}

	if ('cause' in record) {
		return getHttpStatusCode(record.cause);
	}

	return undefined;
}

/** Deck returns 403 for missing entities as well as permission errors. */
export function formatDeckAccessErrorMessage(
	statusCode: number | undefined,
	scrubbedMessage: string,
): string {
	if (statusCode === 403 || statusCode === 404) {
		return `Not found or access denied (${statusCode}). Verify the board, stack, and card ids.`;
	}
	if (/forbidden|permission denied|perhaps check your credentials/i.test(scrubbedMessage)) {
		return 'Not found or access denied. Verify the board, stack, and card ids.';
	}
	return scrubbedMessage;
}
