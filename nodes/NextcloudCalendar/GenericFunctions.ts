import type { IDataObject } from 'n8n-workflow';
import { z } from 'zod';

import { assertHttpMethodIsValid } from '../shared/assertHttpMethodIsValid';
import type { NextcloudHttpMethod } from '../shared/assertHttpMethodIsValid';
import {
	parseNextcloudCredentials,
	parseRequiredString,
	throwParseError,
} from '../shared/parse';
import type { NextcloudRequestContext } from '../shared/requestContext';
import type {
	NextcloudCalendarOption,
	NextcloudCredentialData,
	NextcloudCredentialName,
} from './EventInterface';

export {
	buildICalendarPayload,
	escapeIcsTextValue,
	icsDateOrDateTimeToIso,
	parseIcsEventVerbose,
	unescapeIcsText,
	unfoldIcsContent,
} from './ics';

const CALENDAR_ROOT_MARKER = '/remote.php/dav/calendars/';

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

function parseTagValue(xml: string, tagName: string): string | undefined {
	const match = xml.match(new RegExp(`<[^>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, 'i'));
	return match?.[1]?.trim();
}

/** Decode common XML text entities (calendar-data is often entity-encoded by Sabre/DAV). */
export function decodeXmlText(value: string): string {
	return value
		.replace(/&#x0*[dD];/g, '\r')
		.replace(/&#x0*[aA];/g, '\n')
		.replace(/&#13;/g, '\r')
		.replace(/&#10;/g, '\n')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Parse a date string to UTC ms.
 * Accepts ISO-8601 and Luxon `DateTime.toString()` (`[DateTime: 2026-08-12T14:29:22.402+02:00]`),
 * which n8n often yields for expressions like `{{ $now.plus({ week: 2 }) }}`.
 */
function parseDateStringToMs(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const luxonWrapped = trimmed.match(/^\[DateTime:\s*(.+?)\]$/i);
	const candidate = (luxonWrapped?.[1] ?? trimmed).trim();
	if (!candidate || /^Invalid DateTime$/i.test(candidate)) return null;

	if (/^\d+(\.\d+)?$/.test(candidate)) {
		const n = Number(candidate);
		if (!Number.isFinite(n)) return null;
		return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
	}

	const parsed = Date.parse(candidate);
	return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Coerce an n8n dateTime parameter (string, epoch, Date, or Luxon-like) to UTC ms.
 * Returns null for empty / unparseable values so optional filters can be skipped.
 */
export function nodeDateToFilterMs(value: unknown): number | null {
	if (value === undefined || value === null || value === '') return null;

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return null;
		return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
	}

	if (value instanceof Date) {
		const ms = value.getTime();
		return Number.isNaN(ms) ? null : ms;
	}

	if (typeof value === 'string') {
		return parseDateStringToMs(value);
	}

	if (typeof value === 'object') {
		if ('toMillis' in value && typeof value.toMillis === 'function') {
			const ms = value.toMillis();
			return Number.isFinite(ms) ? ms : null;
		}
		if ('toJSDate' in value && typeof value.toJSDate === 'function') {
			const date = value.toJSDate();
			if (date instanceof Date) {
				const ms = date.getTime();
				return Number.isNaN(ms) ? null : ms;
			}
		}
		if ('toISO' in value && typeof value.toISO === 'function') {
			const iso = value.toISO();
			if (typeof iso === 'string' && iso.trim()) {
				return parseDateStringToMs(iso);
			}
		}
		// Proxied / serialized Luxon often only survives as `String(value)` → `[DateTime: …]`.
		const asString = String(value);
		if (asString && asString !== '[object Object]') {
			return parseDateStringToMs(asString);
		}
	}

	return null;
}

/** Format UTC milliseconds as CalDAV `time-range` stamp (`YYYYMMDDTHHMMSSZ`). */
export function toCalDavUtcStamp(ms: number): string {
	return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
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
	context: NextcloudRequestContext,
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
	context: NextcloudRequestContext,
	method: NextcloudHttpMethod,
	url: string,
	body?: string | IDataObject,
	headers?: IDataObject,
	credentialName?: NextcloudCredentialName,
) {
	assertHttpMethodIsValid(method);

	const resolvedCredentialName =
		credentialName ??
		resolveCredentialName(
			parseRequiredString(
				context.getNodeParameter('authentication', 0, 'basicAuth'),
				'Authentication',
			),
		);

	return await context.helpers.httpRequestWithAuthentication.call(context, resolvedCredentialName, {
		method: method,
		url,
		body,
		headers: {
			...(headers ?? {}),
		},
		returnFullResponse: false,
	});
}

export async function loadCalendars(
	context: NextcloudRequestContext,
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

/**
 * Nextcloud Calendar UI deep link that opens the event editor.
 *
 * `objectId` is base64 of `{webroot}/remote.php/dav/calendars/{userId}/{calendarId}/{eventId}.ics`
 * (same shape as `calendar.view.indexdirect.edit` / `/apps/calendar/edit/:objectId`).
 * `eventId` is the CalDAV filename stem, not the ICS UID.
 */
export function buildCalendarEventWebUrl(
	baseUrl: string,
	userId: string,
	calendarId: string,
	eventId: string,
): string {
	const normalized = normalizeBaseUrl(baseUrl);
	let origin = normalized;
	let webroot = '';
	try {
		const parsed = new URL(normalized);
		origin = parsed.origin;
		webroot = parsed.pathname.replace(/\/+$/, '');
	} catch {
		// keep normalized as origin when URL parsing fails
	}

	const fileName = eventId.endsWith('.ics') ? eventId : `${eventId}.ics`;
	const davObjectPath = `${webroot}/remote.php/dav/calendars/${userId}/${calendarId}/${fileName}`;
	const objectId = Buffer.from(davObjectPath, 'utf8').toString('base64');
	return `${origin}${webroot}/apps/calendar/edit/${objectId}`;
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
		out.push({
			href,
			ics: calendarData !== undefined ? decodeXmlText(calendarData) : undefined,
		});
	}

	return out;
}
