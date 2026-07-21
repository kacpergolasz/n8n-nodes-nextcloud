import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { z } from 'zod';

import {
	parseNextcloudCredentials,
	parseRequiredString,
	throwParseError,
} from '../shared/parse';
import type {
	NextcloudCalendarOption,
	NextcloudCredentialData,
	NextcloudCredentialName,
	NextcloudEventInput,
} from './EventInterface';

/** n8n's IHttpRequestMethods omits CalDAV verbs like PROPFIND. */
type NextcloudHttpMethod = IHttpRequestMethods | 'PROPFIND';

const CALENDAR_ROOT_MARKER = '/remote.php/dav/calendars/';

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

function sanitizeFileNamePart(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function parseTagValue(xml: string, tagName: string): string | undefined {
	const match = xml.match(new RegExp(`<[^>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, 'i'));
	return match?.[1]?.trim();
}

/** Nextcloud exposes calendars under `{base}/remote.php/dav/calendars/{username}/`. */
export function buildCalendarHomeUrl(credentials: NextcloudCredentialData): string {
	const base = normalizeBaseUrl(credentials.baseUrl);
	const user = encodeURIComponent(credentials.username);
	return `${base}/remote.php/dav/calendars/${user}/`;
}

function decodeDavHref(href: string): string {
	try {
		return decodeURIComponent(href);
	} catch {
		return href;
	}
}

/**
 * True if href points to an actual calendar collection (not only the user's calendar home root).
 */
export function isCalendarCollectionHref(href: string): boolean {
	const decoded = decodeDavHref(href).trim();
	if (/\.ics(\/|$)/i.test(decoded)) return false;
	const markerIndex = decoded.indexOf(CALENDAR_ROOT_MARKER);
	if (markerIndex === -1) return false;
	const tail = decoded.slice(markerIndex + CALENDAR_ROOT_MARKER.length).replace(/\/+$/, '');
	const segments = tail.split('/').filter(Boolean);
	return segments.length >= 2;
}

export function parseCalendarsFromXml(xml: string): NextcloudCalendarOption[] {
	const responseBlocks = xml.split(/<[^>]*:?response>/i).slice(1);
	const calendars: NextcloudCalendarOption[] = [];

	for (const block of responseBlocks) {
		const href = parseTagValue(block, 'href');
		if (!href || !isCalendarCollectionHref(href)) continue;

		const displayName = parseTagValue(block, 'displayname') || decodeDavHref(href);
		calendars.push({
			name: displayName,
			value: href,
		});
	}

	return calendars;
}

export function resolveCredentialName(authentication: string): NextcloudCredentialName {
	return authentication === 'oAuth2' ? 'nextcloudOAuth2Api' : 'nextcloudApi';
}

const nextcloudOAuth2CredentialSchema = z.object({
	baseUrl: z.string().min(1, 'Base URL is required'),
	username: z.string().min(1, 'Username is required'),
	clientSecret: z.string().optional(),
	oauthTokenData: z
		.object({
			access_token: z.string().optional(),
			refresh_token: z.string().optional(),
		})
		.passthrough()
		.optional(),
});

function parseNextcloudOAuth2Credentials(raw: unknown) {
	try {
		return nextcloudOAuth2CredentialSchema.parse(raw);
	} catch (error) {
		throwParseError(error, 'Invalid Nextcloud OAuth2 credentials');
	}
}

export async function getCredentials(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<NextcloudCredentialData> {
	const authentication = parseRequiredString(
		context.getNodeParameter('authentication', 0, 'basicAuth'),
		'Authentication',
	);
	const credentialName = resolveCredentialName(authentication);
	const raw = await context.getCredentials(credentialName);

	if (credentialName === 'nextcloudApi') {
		const parsed = parseNextcloudCredentials(raw);
		return {
			baseUrl: normalizeBaseUrl(parsed.baseUrl),
			username: parsed.username,
			credentialName,
			authentication: 'basicAuth',
			appPassword: parsed.appPassword,
		};
	}

	const oauthParsed = parseNextcloudOAuth2Credentials(raw);
	return {
		baseUrl: normalizeBaseUrl(oauthParsed.baseUrl),
		username: oauthParsed.username,
		credentialName,
		authentication: 'oAuth2',
		clientSecret: oauthParsed.clientSecret,
		accessToken: oauthParsed.oauthTokenData?.access_token,
		refreshToken: oauthParsed.oauthTokenData?.refresh_token,
	};
}

export async function nextcloudRequest(
	context: ILoadOptionsFunctions | IExecuteFunctions,
	method: NextcloudHttpMethod,
	url: string,
	body?: string | IDataObject,
	headers?: IDataObject,
	credentialName?: NextcloudCredentialName,
) {
	const resolvedCredentialName =
		credentialName ??
		resolveCredentialName(
			parseRequiredString(
				context.getNodeParameter('authentication', 0, 'basicAuth'),
				'Authentication',
			),
		);

	return await context.helpers.httpRequestWithAuthentication.call(context, resolvedCredentialName, {
		// CAST-ALLOWLIST: CalDAV — n8n IHttpRequestMethods omits PROPFIND (Phase 8 → eslint-disable)
		method: method as IHttpRequestMethods,
		url,
		body,
		headers: {
			...(headers ?? {}),
		},
		returnFullResponse: false,
	});
}

export async function loadCalendars(
	context: ILoadOptionsFunctions | IExecuteFunctions,
): Promise<NextcloudCalendarOption[]> {
	const credentials = await getCredentials(context);
	const calendarHomeUrl = buildCalendarHomeUrl(credentials);
	const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
	<d:prop>
		<d:displayname />
	</d:prop>
</d:propfind>`;

	const response = await nextcloudRequest(context, 'PROPFIND', calendarHomeUrl, propfindBody, {
		Depth: '1',
		'Content-Type': 'application/xml; charset=utf-8',
		Accept: 'application/xml',
	});

	const xml = typeof response === 'string' ? response : JSON.stringify(response);
	return parseCalendarsFromXml(xml);
}

export function resolveCalendarPath(baseUrl: string, calendarInput: string): string {
	const trimmed = calendarInput.trim();

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	const prefix = trimmed.startsWith('/') ? '' : '/';
	return `${normalizeBaseUrl(baseUrl)}${prefix}${trimmed}`;
}

/**
 * Resolve calendar URL: accepts full DAV path or absolute URL, or short name `personal` using credential username.
 */
export function resolveCalendarUrl(
	baseUrl: string,
	username: string,
	calendarInput: string,
): string {
	const trimmed = calendarInput.trim();
	if (/^https?:\/\//i.test(trimmed)) return trimmed;

	if (/remote\.php\/dav\/calendars\//i.test(trimmed) || trimmed.startsWith('/remote.php/')) {
		return resolveCalendarPath(baseUrl, trimmed);
	}

	const slug = trimmed.replace(/^\/+|\/+$/g, '');
	if (!slug) {
		throw new Error('Calendar name is empty.');
	}

	const encodedSegments = slug.split('/').map((part) => encodeURIComponent(part)).join('/');
	return `${normalizeBaseUrl(baseUrl)}${CALENDAR_ROOT_MARKER}${encodeURIComponent(
		username,
	)}/${encodedSegments}/`;
}

/** Decoded owner and calendar path from a resolved calendar collection URL (`…/calendars/{user}/{calendar}/`). */
export function parseUserIdAndCalendarIdFromCalendarUrl(calendarUrl: string): {
	userId: string;
	calendarId: string;
} {
	const trimmed = calendarUrl.trim().replace(/\/+$/, '');
	const lower = trimmed.toLowerCase();
	const marker = CALENDAR_ROOT_MARKER.toLowerCase();
	const idx = lower.indexOf(marker);
	if (idx === -1) {
		throw new Error('Calendar URL is not a Nextcloud CalDAV calendars path.');
	}
	const tail = trimmed.slice(idx + CALENDAR_ROOT_MARKER.length);
	const segments = tail.split('/').filter(Boolean);
	if (segments.length < 2) {
		throw new Error('Calendar URL must include user id and calendar id segments.');
	}
	const userId = decodeURIComponent(segments[0]);
	const calendarId = segments
		.slice(1)
		.map((segment) => decodeURIComponent(segment))
		.join('/');
	return { userId, calendarId };
}

/** Basename of the `.ics` resource without extension, suitable for `eventId` / `buildEventUrl`. */
export function eventIdFromCalDavHref(href: string): string {
	const decoded = decodeDavHref(href).trim().replace(/\/+$/, '');
	const slash = decoded.lastIndexOf('/');
	const fileName = slash === -1 ? decoded : decoded.slice(slash + 1);
	if (fileName.toLowerCase().endsWith('.ics')) {
		return fileName.slice(0, -4);
	}
	return fileName;
}

export function buildEventUrl(calendarPath: string, eventId: string): string {
	const suffix = eventId.endsWith('.ics') ? eventId : `${eventId}.ics`;
	const normalizedPath = calendarPath.endsWith('/') ? calendarPath : `${calendarPath}/`;
	return `${normalizedPath}${encodeURIComponent(suffix)}`;
}

export function buildICalendarPayload(input: NextcloudEventInput, uid?: string): string {
	const uidValue = uid ?? `${Date.now()}-${sanitizeFileNamePart(input.summary)}@n8n-nextcloud`;
	const escapedSummary = escapeIcsTextValue(input.summary);
	const escapedDescription = escapeIcsTextValue(input.description ?? '');
	const escapedLocation = escapeIcsTextValue(input.location ?? '');
	const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	const dtStart = input.start.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	const dtEnd = input.end.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//n8n//Nextcloud Calendar Node//EN',
		'BEGIN:VEVENT',
		`UID:${uidValue}`,
		`DTSTAMP:${dtStamp}`,
		`DTSTART:${dtStart}`,
		`DTEND:${dtEnd}`,
		`SUMMARY:${escapedSummary}`,
		`DESCRIPTION:${escapedDescription}`,
		`LOCATION:${escapedLocation}`,
		'END:VEVENT',
		'END:VCALENDAR',
	].join('\r\n');
}

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

function tzidFromParamPart(paramPart: string): string | undefined {
	const m = paramPart.match(/(?:^|;)TZID=([^;:]+)/i);
	return m?.[1]?.trim();
}

/**
 * Parses the first VEVENT in an iCalendar blob into optional JSON fields (omit missing properties).
 * Excludes UID. Suitable for "get event" style responses.
 */
export function parseIcsEventVerbose(rawIcs: string): IDataObject {
	const unfolded = unfoldIcsContent(rawIcs.trim());
	const veMatch = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/i);
	if (!veMatch) return {};

	let vBody = veMatch[1] ?? '';
	vBody = vBody.replace(/BEGIN:VALARM[\s\S]*?END:VALARM/gi, '');

	type PropEntry = { params: string; value: string };
	const lastByName: Record<string, PropEntry> = {};
	const attendees: string[] = [];

	for (const rawLine of vBody.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('BEGIN:') || line.startsWith('END:')) continue;

		const colon = line.indexOf(':');
		if (colon === -1) continue;

		const lhs = line.slice(0, colon);
		const value = line.slice(colon + 1);
		const semi = lhs.indexOf(';');
		const propName = (semi === -1 ? lhs : lhs.slice(0, semi)).toUpperCase();
		const paramPart = semi === -1 ? '' : lhs.slice(semi);

		if (propName === 'ATTENDEE') {
			const t = unescapeIcsText(value).trim();
			if (t) attendees.push(t);
			continue;
		}

		lastByName[propName] = { params: paramPart, value };
	}

	const out: IDataObject = {};

	const setIf = (key: string, val: IDataObject[string]) => {
		if (val === undefined || val === null) return;
		if (typeof val === 'string' && val.length === 0) return;
		if (Array.isArray(val) && val.length === 0) return;
		out[key] = val;
	};

	const dtStart = lastByName.DTSTART;
	if (dtStart) {
		const iso = icsDateOrDateTimeToIso(dtStart.params, dtStart.value);
		setIf('date_start', iso);
		const tz = tzidFromParamPart(dtStart.params);
		setIf('start_tzid', tz);
	}

	const dtEnd = lastByName.DTEND;
	if (dtEnd) {
		const iso = icsDateOrDateTimeToIso(dtEnd.params, dtEnd.value);
		setIf('date_end', iso);
		const tz = tzidFromParamPart(dtEnd.params);
		setIf('end_tzid', tz);
	}

	const created = lastByName.CREATED;
	if (created) {
		setIf('created_at', icsDateOrDateTimeToIso(created.params, created.value));
	}

	const lastMod = lastByName['LAST-MODIFIED'];
	if (lastMod) {
		setIf('updated_at', icsDateOrDateTimeToIso(lastMod.params, lastMod.value));
	}

	const dtStamp = lastByName.DTSTAMP;
	if (dtStamp) {
		setIf('dtstamp', icsDateOrDateTimeToIso(dtStamp.params, dtStamp.value));
	}

	const summary = lastByName.SUMMARY;
	if (summary) setIf('summary', unescapeIcsText(summary.value));

	const description = lastByName.DESCRIPTION;
	if (description) setIf('description', unescapeIcsText(description.value));

	const location = lastByName.LOCATION;
	if (location) setIf('location', unescapeIcsText(location.value));

	const status = lastByName.STATUS;
	if (status) setIf('status', status.value.trim());

	const transp = lastByName.TRANSP;
	if (transp) setIf('transp', transp.value.trim());

	const url = lastByName.URL;
	if (url) setIf('url', unescapeIcsText(url.value));

	const organizer = lastByName.ORGANIZER;
	if (organizer) setIf('organizer', unescapeIcsText(organizer.value));

	const rrule = lastByName.RRULE;
	if (rrule) setIf('recurrence_rule', rrule.value.trim());

	const rid = lastByName['RECURRENCE-ID'];
	if (rid) {
		setIf('recurrence_id', icsDateOrDateTimeToIso(rid.params, rid.value));
		const tz = tzidFromParamPart(rid.params);
		setIf('recurrence_id_tzid', tz);
	}

	const cls = lastByName.CLASS;
	if (cls) setIf('class', cls.value.trim());

	const priority = lastByName.PRIORITY;
	if (priority) {
		const n = parseInt(priority.value.trim(), 10);
		setIf('priority', Number.isFinite(n) ? n : priority.value.trim());
	}

	const sequence = lastByName.SEQUENCE;
	if (sequence) {
		const n = parseInt(sequence.value.trim(), 10);
		setIf('sequence', Number.isFinite(n) ? n : sequence.value.trim());
	}

	const categories = lastByName.CATEGORIES;
	if (categories) {
		const parts = categories.value.split(',').map((p) => unescapeIcsText(p.trim()));
		setIf('categories', parts.filter(Boolean));
	}

	const geo = lastByName.GEO;
	if (geo) setIf('geo', geo.value.trim());

	setIf('attendees', attendees.length ? attendees : undefined);

	return out;
}

export function parseEventHrefsFromMultistatus(xml: string): string[] {
	const hrefMatches = Array.from(xml.matchAll(/<[^>]*:?href[^>]*>(.*?)<\/[^>]*:?href>/gi));
	return hrefMatches.map((match) => match[1]).filter((href) => href.endsWith('.ics'));
}

/**
 * Parses the first VEVENT DTSTART value to UTC milliseconds.
 * Supports floating `YYYYMMDDTHHMMSS`, UTC `…Z`, and all-day `YYYYMMDD` / `VALUE=DATE`.
 * TZID values are parsed as if the wall time were UTC (limitation without a timezone database).
 */
export function parseDtStartFromIcs(ics: string): number | undefined {
	const dtstartLine = ics.match(/^DTSTART(?:;[^:]*)?:([^\r\n]+)/im)?.[1];
	if (!dtstartLine) return undefined;
	const value = dtstartLine.trim();
	if (/^\d{8}$/.test(value)) {
		const y = parseInt(value.slice(0, 4), 10);
		const mo = parseInt(value.slice(4, 6), 10) - 1;
		const d = parseInt(value.slice(6, 8), 10);
		return Date.UTC(y, mo, d, 0, 0, 0, 0);
	}
	const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
	if (!m) return undefined;
	const y = parseInt(m[1], 10);
	const mo = parseInt(m[2], 10) - 1;
	const d = parseInt(m[3], 10);
	const h = parseInt(m[4], 10);
	const mi = parseInt(m[5], 10);
	const s = parseInt(m[6], 10);
	return Date.UTC(y, mo, d, h, mi, s, 0);
}

/** One entry per calendar object response that references an `.ics` resource. */
export function parseEventHrefAndIcsFromMultistatus(xml: string): { href: string; ics?: string }[] {
	const responseBlocks = xml.split(/<[^>]*:?response>/i).slice(1);
	const out: { href: string; ics?: string }[] = [];

	for (const block of responseBlocks) {
		const href = parseTagValue(block, 'href');
		if (!href || !href.endsWith('.ics')) continue;
		const calendarData = parseTagValue(block, 'calendar-data');
		out.push({ href, ics: calendarData });
	}

	return out;
}
