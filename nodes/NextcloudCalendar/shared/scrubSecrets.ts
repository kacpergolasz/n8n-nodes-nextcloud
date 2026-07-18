const REDACTED = '[REDACTED]';

export type ScrubSecretsInput = {
	appPassword?: string;
	username?: string;
};

/**
 * Redact Nextcloud credential material from user-visible error strings.
 * Covers appPassword, Basic Auth headers, and username:password substrings.
 */
export function scrubSecrets(text: string, secrets: ScrubSecretsInput = {}): string {
	let out = text;

	const username = secrets.username?.trim() ?? '';
	const appPassword = secrets.appPassword?.trim() ?? '';

	if (username && appPassword) {
		out = out.split(`${username}:${appPassword}`).join(`${username}:${REDACTED}`);
	}

	if (appPassword) {
		out = out.split(appPassword).join(REDACTED);
	}

	out = out.replace(/Authorization:\s*Basic\s+\S+/gi, `Authorization: Basic ${REDACTED}`);
	out = out.replace(/\bBasic\s+[A-Za-z0-9+/=_-]{8,}/g, `Basic ${REDACTED}`);

	out = out.replace(
		/(https?:\/\/)([^:/@\s]+):([^@/\s]+)@/gi,
		(_match, protocol: string, user: string) => `${protocol}${user}:${REDACTED}@`,
	);

	return out;
}

export function scrubErrorMessage(error: unknown, secrets: ScrubSecretsInput = {}): string {
	const message = error instanceof Error ? error.message : String(error);
	return scrubSecrets(message, secrets);
}
