import type { IDataObject } from 'n8n-workflow';

import { icsDateOrDateTimeToIso, paramsToParamPart, tzidFromParams, unescapeIcsText } from './dates';
import { findFirstVEvent, parseIcs } from './parse';
import type { IcsComponent, IcsProperty } from './types';

export type { IcsComponent, IcsParam, IcsProperty } from './types';
export { buildICalendarPayload, buildMinimalEventCalendar } from './build';
export {
	escapeIcsTextValue,
	icsDateOrDateTimeToIso,
	isoToFloatingIcsDateTime,
	isoToIcsDate,
	isoToIcsDateTime,
	paramsToParamPart,
	tzidFromParams,
	unescapeIcsText,
	unfoldIcsContent,
	utcNowIcsDateTime,
} from './dates';
export { findFirstVEvent, parseIcs } from './parse';
export { patchEventCalendar } from './patchEvent';
export type { PatchEventOptions, PatchEventResult } from './patchEvent';
export { foldIcsLine, serializeIcs } from './serialize';

function lastByName(vevent: IcsComponent): Map<string, IcsProperty> {
	const map = new Map<string, IcsProperty>();
	for (const prop of vevent.properties) {
		map.set(prop.name.toUpperCase(), prop);
	}
	return map;
}

function allByName(vevent: IcsComponent, name: string): IcsProperty[] {
	const upper = name.toUpperCase();
	return vevent.properties.filter((p) => p.name.toUpperCase() === upper);
}

/**
 * Project the first VEVENT into optional JSON fields (omit missing properties).
 * Excludes UID. Suitable for Get-style responses. Nested VALARM is ignored for projection.
 */
export function projectVEventVerbose(vevent: IcsComponent): IDataObject {
	const last = lastByName(vevent);
	const out: IDataObject = {};

	const setIf = (key: string, val: IDataObject[string]) => {
		if (val === undefined || val === null) return;
		if (typeof val === 'string' && val.length === 0) return;
		if (Array.isArray(val) && val.length === 0) return;
		out[key] = val;
	};

	const dtStart = last.get('DTSTART');
	if (dtStart) {
		const paramPart = paramsToParamPart(dtStart.params);
		setIf('date_start', icsDateOrDateTimeToIso(paramPart, dtStart.value));
		setIf('start_tzid', tzidFromParams(dtStart.params));
	}

	const dtEnd = last.get('DTEND');
	if (dtEnd) {
		const paramPart = paramsToParamPart(dtEnd.params);
		setIf('date_end', icsDateOrDateTimeToIso(paramPart, dtEnd.value));
		setIf('end_tzid', tzidFromParams(dtEnd.params));
	}

	const created = last.get('CREATED');
	if (created) {
		setIf('created_at', icsDateOrDateTimeToIso(paramsToParamPart(created.params), created.value));
	}

	const lastMod = last.get('LAST-MODIFIED');
	if (lastMod) {
		setIf('updated_at', icsDateOrDateTimeToIso(paramsToParamPart(lastMod.params), lastMod.value));
	}

	const dtStamp = last.get('DTSTAMP');
	if (dtStamp) {
		setIf('dtstamp', icsDateOrDateTimeToIso(paramsToParamPart(dtStamp.params), dtStamp.value));
	}

	const summary = last.get('SUMMARY');
	if (summary) setIf('summary', unescapeIcsText(summary.value));

	const description = last.get('DESCRIPTION');
	if (description) setIf('description', unescapeIcsText(description.value));

	const location = last.get('LOCATION');
	if (location) setIf('location', unescapeIcsText(location.value));

	const status = last.get('STATUS');
	if (status) setIf('status', status.value.trim());

	const transp = last.get('TRANSP');
	if (transp) setIf('transp', transp.value.trim());

	const url = last.get('URL');
	if (url) setIf('url', unescapeIcsText(url.value));

	const organizer = last.get('ORGANIZER');
	if (organizer) setIf('organizer', unescapeIcsText(organizer.value));

	const rrule = last.get('RRULE');
	if (rrule) setIf('recurrence_rule', rrule.value.trim());

	const rid = last.get('RECURRENCE-ID');
	if (rid) {
		setIf('recurrence_id', icsDateOrDateTimeToIso(paramsToParamPart(rid.params), rid.value));
		setIf('recurrence_id_tzid', tzidFromParams(rid.params));
	}

	const cls = last.get('CLASS');
	if (cls) setIf('class', cls.value.trim());

	const priority = last.get('PRIORITY');
	if (priority) {
		const n = parseInt(priority.value.trim(), 10);
		setIf('priority', Number.isFinite(n) ? n : priority.value.trim());
	}

	const sequence = last.get('SEQUENCE');
	if (sequence) {
		const n = parseInt(sequence.value.trim(), 10);
		setIf('sequence', Number.isFinite(n) ? n : sequence.value.trim());
	}

	const categories = last.get('CATEGORIES');
	if (categories) {
		const parts = categories.value.split(',').map((p) => unescapeIcsText(p.trim()));
		setIf('categories', parts.filter(Boolean));
	}

	const geo = last.get('GEO');
	if (geo) setIf('geo', geo.value.trim());

	const attendees = allByName(vevent, 'ATTENDEE')
		.map((p) => unescapeIcsText(p.value).trim())
		.filter(Boolean);
	setIf('attendees', attendees.length ? attendees : undefined);

	return out;
}

/**
 * Parses the first VEVENT in an iCalendar blob into optional JSON fields (omit missing properties).
 * Excludes UID. Suitable for "get event" style responses.
 */
export function parseIcsEventVerbose(rawIcs: string): IDataObject {
	const calendar = parseIcs(rawIcs);
	const vevent = findFirstVEvent(calendar);
	if (!vevent) return {};
	return projectVEventVerbose(vevent);
}
