/** RFC 5545 DATE / DATE-TIME / TEXT helpers for Calendar ICS. */

/** RFC 5545 line folding: remove CRLF followed by a single space or tab. */
export function unfoldIcsContent(content: string): string {
	return content.replace(/\r?\n[ \t]/g, '');
}

/** RFC 5545 TEXT: escape `\`, `;`, `,`, and newlines (CR/LF → `\n`). */
export function escapeIcsTextValue(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\n|\r/g, '\\n');
}

export function unescapeIcsText(value: string): string {
	return value.replace(/\\([\\,;nN])/g, (_, ch: string) => {
		if (ch === 'n' || ch === 'N') return '\n';
		return ch;
	});
}

/**
 * Normalizes ICS DATE / DATE-TIME values to ISO-8601-like strings.
 * All-day (VALUE=DATE or bare YYYYMMDD) → `YYYY-MM-DDT00:00:00Z` (UTC day boundary).
 * UTC / Zulu datetimes → full ISO with Z. Floating local times → `YYYY-MM-DDTHH:mm:ss` without offset.
 */
export function icsDateOrDateTimeToIso(paramPart: string, value: string): string | undefined {
	const v = value.trim();
	const params = paramPart.toUpperCase();
	const dateOnly = params.includes(';VALUE=DATE') || /^\d{8}$/.test(v);

	if (dateOnly && /^\d{8}$/.test(v)) {
		return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`;
	}

	const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
	if (m) {
		const isoDate = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
		return m[7] === 'Z' ? `${isoDate}Z` : isoDate;
	}

	if (/^\d{8}$/.test(v)) {
		return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`;
	}

	return v.length > 0 ? v : undefined;
}

/** Reconstruct `;PARAM=…` suffix used by {@link icsDateOrDateTimeToIso}. */
export function paramsToParamPart(params: { name: string; value?: string }[]): string {
	if (params.length === 0) return '';
	return (
		';' +
		params
			.map((p) => (p.value === undefined ? p.name : `${p.name}=${p.value}`))
			.join(';')
	);
}

export function tzidFromParams(params: { name: string; value?: string }[]): string | undefined {
	const found = params.find((p) => p.name.toUpperCase() === 'TZID');
	return found?.value?.trim();
}

/**
 * Convert an ISO-8601-like datetime (n8n dateTime) to ICS DATE-TIME.
 * `2026-05-10T09:00:00.000Z` → `20260510T090000Z`; floating times keep no Z.
 */
export function isoToIcsDateTime(iso: string): string {
	return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Current UTC instant as ICS DATE-TIME (`…Z`). */
export function utcNowIcsDateTime(now: Date = new Date()): string {
	return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
