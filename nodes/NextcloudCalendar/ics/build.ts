import type { NextcloudEventInput } from '../EventInterface';
import { assertIcsEndAfterStart, escapeIcsTextValue, isoToIcsDateTime, utcNowIcsDateTime } from './dates';
import { serializeIcs } from './serialize';
import type { IcsComponent, IcsProperty } from './types';

function sanitizeFileNamePart(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function textProp(name: string, value: string): IcsProperty {
	return { name, params: [], value: escapeIcsTextValue(value) };
}

function rawProp(name: string, value: string): IcsProperty {
	return { name, params: [], value };
}

/**
 * Build a minimal VCALENDAR/VEVENT AST for Create.
 * Omits DESCRIPTION / LOCATION unless the caller set a non-empty value.
 */
export function buildMinimalEventCalendar(input: NextcloudEventInput, uid?: string): IcsComponent {
	const uidValue = uid ?? `${Date.now()}-${sanitizeFileNamePart(input.summary)}@n8n-nextcloud`;
	const dtStart = isoToIcsDateTime(input.start);
	const dtEnd = isoToIcsDateTime(input.end);
	assertIcsEndAfterStart(dtStart, dtEnd);

	const properties: IcsProperty[] = [
		rawProp('UID', uidValue),
		rawProp('DTSTAMP', utcNowIcsDateTime()),
		rawProp('DTSTART', dtStart),
		rawProp('DTEND', dtEnd),
		textProp('SUMMARY', input.summary),
	];

	if (input.description !== undefined && input.description.length > 0) {
		properties.push(textProp('DESCRIPTION', input.description));
	}
	if (input.location !== undefined && input.location.length > 0) {
		properties.push(textProp('LOCATION', input.location));
	}

	const vevent: IcsComponent = {
		name: 'VEVENT',
		properties,
		components: [],
	};

	return {
		name: 'VCALENDAR',
		properties: [
			rawProp('VERSION', '2.0'),
			rawProp('PRODID', '-//n8n//Nextcloud Calendar Node//EN'),
		],
		components: [vevent],
	};
}

/** Create-path facade: minimal AST → folded ICS string. */
export function buildICalendarPayload(input: NextcloudEventInput, uid?: string): string {
	return serializeIcs(buildMinimalEventCalendar(input, uid));
}
