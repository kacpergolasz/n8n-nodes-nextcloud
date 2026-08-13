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

function hasExplicitUtcOrOffset(iso: string): boolean {
	return /Z$/i.test(iso) || /[+-]\d{2}:?\d{2}$/.test(iso);
}

/**
 * Convert an ISO-8601-like datetime (n8n dateTime) to ICS DATE-TIME.
 * UTC / offset forms → `YYYYMMDDTHHMMSSZ`. Floating (no Z/offset) → `YYYYMMDDTHHMMSS`.
 */
export function isoToIcsDateTime(iso: string): string {
	const trimmed = iso.trim();
	if (hasExplicitUtcOrOffset(trimmed)) {
		const date = new Date(trimmed);
		if (Number.isNaN(date.getTime())) {
			throw new Error(`Invalid datetime for ICS conversion: ${iso}`);
		}
		return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	}
	// Floating wall-clock: keep digits only (no Z).
	const floating = trimmed.replace(/[-:]/g, '').replace(/\.\d+/, '');
	if (!/^\d{8}T\d{6}$/.test(floating)) {
		throw new Error(`Invalid floating datetime for ICS conversion: ${iso}`);
	}
	return floating;
}

/**
 * Convert an ISO-8601-like datetime to ICS DATE (`YYYYMMDD`) for all-day events.
 * Uses the calendar date portion only.
 */
export function isoToIcsDate(iso: string): string {
	const trimmed = iso.trim();
	const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (m) return `${m[1]}${m[2]}${m[3]}`;
	if (/^\d{8}$/.test(trimmed)) return trimmed;
	const ics = isoToIcsDateTime(trimmed);
	const datePart = ics.slice(0, 8);
	if (/^\d{8}$/.test(datePart)) return datePart;
	throw new Error(`Invalid date for all-day conversion: ${iso}`);
}

/**
 * Convert ISO datetime to floating ICS DATE-TIME (no Z) for already-local wall-clock values.
 * Prefer {@link isoToFloatingIcsDateTimeInTzid} when writing TZID properties from UTC/`Z` input.
 */
export function isoToFloatingIcsDateTime(iso: string): string {
	return isoToIcsDateTime(iso).replace(/Z$/i, '');
}

function formatInstantAsFloatingInTzid(date: Date, tzid: string): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tzid,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((p) => p.type === type)?.value ?? '';
	return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/**
 * Convert ISO datetime to floating ICS DATE-TIME in a target IANA timezone.
 * UTC (`…Z`) and offset forms are projected to wall-clock in `tzid`.
 * Floating (no Z / offset) values are treated as already-local wall-clock digits.
 */
export function isoToFloatingIcsDateTimeInTzid(iso: string, tzid: string): string {
	const trimmed = iso.trim();
	if (hasExplicitUtcOrOffset(trimmed)) {
		const date = new Date(trimmed);
		if (Number.isNaN(date.getTime())) {
			throw new Error(`Invalid datetime for timezone conversion: ${iso}`);
		}
		// Invalid IANA tzid → RangeError from Intl (wrapped as NodeOperationError in Update).
		return formatInstantAsFloatingInTzid(date, tzid);
	}
	return isoToFloatingIcsDateTime(trimmed);
}

/**
 * Convert an ISO-8601-like datetime to ICS DATE (`YYYYMMDD`) for all-day events.
 * Uses the calendar date portion only.
 */
export function isoToIcsDate(iso: string): string {
	const trimmed = iso.trim();
	const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (m) return `${m[1]}${m[2]}${m[3]}`;
	if (/^\d{8}$/.test(trimmed)) return trimmed;
	const ics = isoToIcsDateTime(trimmed);
	const datePart = ics.slice(0, 8);
	if (/^\d{8}$/.test(datePart)) return datePart;
	throw new Error(`Invalid date for all-day conversion: ${iso}`);
}

/**
 * Convert ISO datetime to floating ICS DATE-TIME (no Z) for TZID-local values.
 * `2026-05-10T09:00:00.000Z` → `20260510T090000`.
 */
export function isoToFloatingIcsDateTime(iso: string): string {
	return isoToIcsDateTime(iso).replace(/Z$/i, '');
}

/** Current UTC instant as ICS DATE-TIME (`…Z`). */
export function utcNowIcsDateTime(now: Date = new Date()): string {
	return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Comparable key for ICS DATE / DATE-TIME values (trailing Z ignored). */
export function icsDateTimeCompareKey(value: string): string {
	return value.trim().replace(/Z$/i, '');
}

/**
 * RFC 5545: DTEND must be later than DTSTART.
 * Call after normalizing both sides to the same ICS representation (and after
 * exclusive all-day DTEND bump when start/end fall on the same DATE).
 */
export function assertIcsEndAfterStart(startIcs: string, endIcs: string): void {
	if (icsDateTimeCompareKey(endIcs) <= icsDateTimeCompareKey(startIcs)) {
		throw new Error(
			'End must be after Start. Provide an End date/time later than Start ' +
				'(for all-day events, End is exclusive — use the day after the last day of the event).',
		);
	}
}
