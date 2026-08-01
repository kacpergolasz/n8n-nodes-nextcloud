import type { EventUpdatePatch } from '../EventInterface';
import {
	escapeIcsTextValue,
	isoToFloatingIcsDateTime,
	isoToIcsDate,
	isoToIcsDateTime,
	tzidFromParams,
	unescapeIcsText,
	utcNowIcsDateTime,
} from './dates';
import { findFirstVEvent } from './parse';
import type { IcsComponent, IcsProperty } from './types';

export type PatchEventOptions = {
	/** Override "now" for DTSTAMP (tests). */
	now?: Date;
};

export type PatchEventResult = {
	/** Same calendar AST reference (mutated in place). */
	calendar: IcsComponent;
	/** True when any whitelist field value changed after normalize. */
	changed: boolean;
	/** True when SEQUENCE was incremented. */
	sequenceBumped: boolean;
};

function lastProp(vevent: IcsComponent, name: string): IcsProperty | undefined {
	const upper = name.toUpperCase();
	let found: IcsProperty | undefined;
	for (const prop of vevent.properties) {
		if (prop.name.toUpperCase() === upper) found = prop;
	}
	return found;
}

function setProp(vevent: IcsComponent, prop: IcsProperty): void {
	const upper = prop.name.toUpperCase();
	const idx = vevent.properties.findIndex((p) => p.name.toUpperCase() === upper);
	if (idx >= 0) {
		vevent.properties[idx] = prop;
	} else {
		vevent.properties.push(prop);
	}
}

function removeProp(vevent: IcsComponent, name: string): void {
	const upper = name.toUpperCase();
	vevent.properties = vevent.properties.filter((p) => p.name.toUpperCase() !== upper);
}

function isAllDayProp(prop: IcsProperty | undefined): boolean {
	if (!prop) return false;
	if (
		prop.params.some(
			(p) => p.name.toUpperCase() === 'VALUE' && (p.value?.toUpperCase() ?? '') === 'DATE',
		)
	) {
		return true;
	}
	return /^\d{8}$/.test(prop.value.trim());
}

function normalizeText(prop: IcsProperty | undefined): string {
	if (!prop) return '';
	return unescapeIcsText(prop.value);
}

function normalizeDateProp(prop: IcsProperty | undefined): string {
	if (!prop) return '';
	const allDay = isAllDayProp(prop);
	const tzid = tzidFromParams(prop.params) ?? '';
	return `${allDay ? 'DATE' : 'DATETIME'}|${tzid}|${prop.value.trim()}`;
}

function existingValueAsIsoish(prop: IcsProperty): string {
	const v = prop.value.trim();
	if (/^\d{8}$/.test(v)) {
		return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
	}
	const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
	if (m) {
		const base = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
		return m[7] === 'Z' ? `${base}Z` : base;
	}
	return v;
}

function buildDtProp(
	name: 'DTSTART' | 'DTEND',
	iso: string,
	mode: { allDay: boolean; tzid?: string },
): IcsProperty {
	if (mode.allDay) {
		return {
			name,
			params: [{ name: 'VALUE', value: 'DATE' }],
			value: isoToIcsDate(iso),
		};
	}
	if (mode.tzid) {
		return {
			name,
			params: [{ name: 'TZID', value: mode.tzid }],
			value: isoToFloatingIcsDateTime(iso),
		};
	}
	return {
		name,
		params: [],
		value: isoToIcsDateTime(iso),
	};
}

function readSequence(vevent: IcsComponent): number {
	const seq = lastProp(vevent, 'SEQUENCE');
	if (!seq) return 0;
	const n = parseInt(seq.value.trim(), 10);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Apply a partial Update Fields patch onto the first VEVENT in the calendar AST.
 * Preserves non-whitelist properties and nested components (VALARM, etc.).
 * Always refreshes DTSTAMP. Bumps SEQUENCE only when a whitelist field actually changes.
 * Never modifies UID.
 */
export function patchEventCalendar(
	calendar: IcsComponent,
	patch: EventUpdatePatch,
	options: PatchEventOptions = {},
): PatchEventResult {
	const vevent = findFirstVEvent(calendar);
	if (!vevent) {
		throw new Error('ICS calendar has no VEVENT to update');
	}

	let changed = false;

	if (patch.summary !== undefined) {
		const current = normalizeText(lastProp(vevent, 'SUMMARY'));
		if (current !== patch.summary) {
			setProp(vevent, {
				name: 'SUMMARY',
				params: [],
				value: escapeIcsTextValue(patch.summary),
			});
			changed = true;
		}
	}

	if (patch.description !== undefined) {
		const current = normalizeText(lastProp(vevent, 'DESCRIPTION'));
		if (current !== patch.description) {
			if (patch.description === '') {
				removeProp(vevent, 'DESCRIPTION');
			} else {
				setProp(vevent, {
					name: 'DESCRIPTION',
					params: [],
					value: escapeIcsTextValue(patch.description),
				});
			}
			changed = true;
		}
	}

	if (patch.location !== undefined) {
		const current = normalizeText(lastProp(vevent, 'LOCATION'));
		if (current !== patch.location) {
			if (patch.location === '') {
				removeProp(vevent, 'LOCATION');
			} else {
				setProp(vevent, {
					name: 'LOCATION',
					params: [],
					value: escapeIcsTextValue(patch.location),
				});
			}
			changed = true;
		}
	}

	const touchesDates =
		patch.start !== undefined ||
		patch.end !== undefined ||
		patch.allDay !== undefined ||
		patch.timezone !== undefined;

	if (touchesDates) {
		const curStart = lastProp(vevent, 'DTSTART');
		const curEnd = lastProp(vevent, 'DTEND');
		const currentAllDay = isAllDayProp(curStart);
		const nextAllDay = patch.allDay !== undefined ? patch.allDay : currentAllDay;

		let nextTzid: string | undefined;
		if (nextAllDay) {
			nextTzid = undefined;
		} else if (patch.timezone !== undefined) {
			const trimmed = patch.timezone.trim();
			nextTzid = trimmed.length > 0 ? trimmed : undefined;
		} else {
			nextTzid = curStart ? tzidFromParams(curStart.params) : undefined;
		}

		const startIso = patch.start ?? (curStart ? existingValueAsIsoish(curStart) : undefined);
		const endIso = patch.end ?? (curEnd ? existingValueAsIsoish(curEnd) : undefined);

		if (!startIso || !endIso) {
			throw new Error(
				'Start and End are required when changing all-day or timezone without existing DTSTART/DTEND',
			);
		}

		const newStart = buildDtProp('DTSTART', startIso, { allDay: nextAllDay, tzid: nextTzid });
		const newEnd = buildDtProp('DTEND', endIso, { allDay: nextAllDay, tzid: nextTzid });

		if (normalizeDateProp(curStart) !== normalizeDateProp(newStart)) {
			setProp(vevent, newStart);
			changed = true;
		}
		if (normalizeDateProp(curEnd) !== normalizeDateProp(newEnd)) {
			setProp(vevent, newEnd);
			changed = true;
		}
	}

	// Always refresh DTSTAMP on write
	setProp(vevent, {
		name: 'DTSTAMP',
		params: [],
		value: utcNowIcsDateTime(options.now),
	});

	let sequenceBumped = false;
	if (changed) {
		setProp(vevent, {
			name: 'SEQUENCE',
			params: [],
			value: String(readSequence(vevent) + 1),
		});
		sequenceBumped = true;
	}

	return { calendar, changed, sequenceBumped };
}
