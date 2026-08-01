import {
	findFirstVEvent,
	parseIcs,
	patchEventCalendar,
	serializeIcs,
	tzidFromParams,
} from '../ics';

const FIXED_NOW = new Date('2026-08-01T12:00:00.000Z');

const RICH_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VTIMEZONE
TZID:Europe/Warsaw
BEGIN:STANDARD
DTSTART:19701025T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:rich-event-uid@example.com
DTSTAMP:20260101T100000Z
SEQUENCE:2
SUMMARY:Rich\\, Event
DESCRIPTION:Keep me
LOCATION:HQ
DTSTART;TZID=Europe/Warsaw:20260511T100000
DTEND;TZID=Europe/Warsaw:20260511T110000
RRULE:FREQ=WEEKLY;BYDAY=MO
X-CUSTOM-PROP:preserve-me
ATTENDEE:mailto:a@example.com
ORGANIZER:mailto:boss@example.com
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR`;

function lastProp(name: string, icsOrAst: string | ReturnType<typeof parseIcs>) {
	const ast = typeof icsOrAst === 'string' ? parseIcs(icsOrAst) : icsOrAst;
	const vevent = findFirstVEvent(ast)!;
	const upper = name.toUpperCase();
	let found;
	for (const p of vevent.properties) {
		if (p.name.toUpperCase() === upper) found = p;
	}
	return found;
}

describe('Calendar ICS patchEventCalendar', () => {
	it('patches summary while preserving RRULE, ATTENDEE, VALARM, X-*, and UID', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(ast, { summary: 'New title' }, { now: FIXED_NOW });

		expect(result.changed).toBe(true);
		expect(result.sequenceBumped).toBe(true);

		const vevent = findFirstVEvent(result.calendar)!;
		expect(vevent.properties.find((p) => p.name.toUpperCase() === 'UID')?.value).toBe(
			'rich-event-uid@example.com',
		);
		expect(vevent.properties.find((p) => p.name.toUpperCase() === 'SUMMARY')?.value).toBe(
			'New title',
		);
		expect(vevent.properties.find((p) => p.name.toUpperCase() === 'RRULE')?.value).toBe(
			'FREQ=WEEKLY;BYDAY=MO',
		);
		expect(vevent.properties.find((p) => p.name.toUpperCase() === 'X-CUSTOM-PROP')?.value).toBe(
			'preserve-me',
		);
		expect(
			vevent.properties.filter((p) => p.name.toUpperCase() === 'ATTENDEE').map((p) => p.value),
		).toEqual(['mailto:a@example.com']);
		expect(vevent.components.some((c) => c.name.toUpperCase() === 'VALARM')).toBe(true);
		expect(result.calendar.components.some((c) => c.name.toUpperCase() === 'VTIMEZONE')).toBe(
			true,
		);

		const serialized = serializeIcs(result.calendar);
		expect(serialized).toMatch(/SUMMARY:New title/);
		expect(serialized).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO/);
		expect(serialized).toMatch(/UID:rich-event-uid@example.com/);
		expect(serialized).toMatch(/BEGIN:VALARM/);
	});

	it('does not bump SEQUENCE on no-op (equal values) but still refreshes DTSTAMP', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(
			ast,
			{ summary: 'Rich, Event', location: 'HQ' },
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(false);
		expect(result.sequenceBumped).toBe(false);
		expect(lastProp('SEQUENCE', result.calendar)?.value).toBe('2');
		expect(lastProp('DTSTAMP', result.calendar)?.value).toBe('20260801T120000Z');
	});

	it('bumps SEQUENCE on meaningful change (missing SEQUENCE treated as 0)', () => {
		const bare = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:bare@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Old
DTSTART:20260511T100000Z
DTEND:20260511T110000Z
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(bare);
		const result = patchEventCalendar(ast, { summary: 'New' }, { now: FIXED_NOW });

		expect(result.sequenceBumped).toBe(true);
		expect(lastProp('SEQUENCE', result.calendar)?.value).toBe('1');
		expect(lastProp('DTSTAMP', result.calendar)?.value).toBe('20260801T120000Z');
	});

	it('increments existing SEQUENCE on meaningful change', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(ast, { description: 'Changed' }, { now: FIXED_NOW });

		expect(result.sequenceBumped).toBe(true);
		expect(lastProp('SEQUENCE', result.calendar)?.value).toBe('3');
	});

	it('emits VALUE=DATE when switching to all-day', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(
			ast,
			{
				allDay: true,
				start: '2026-05-11T10:00:00Z',
				end: '2026-05-12T10:00:00Z',
			},
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(dtStart.params.some((p) => p.name.toUpperCase() === 'VALUE' && p.value === 'DATE')).toBe(
			true,
		);
		expect(dtStart.value).toBe('20260511');
		expect(tzidFromParams(dtStart.params)).toBeUndefined();

		const serialized = serializeIcs(result.calendar);
		expect(serialized).toMatch(/DTSTART;VALUE=DATE:20260511/);
		expect(serialized).toMatch(/DTEND;VALUE=DATE:20260512/);
	});

	it('preserves TZID on timed events when timezone field is unset', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(
			ast,
			{
				start: '2026-05-11T14:00:00',
				end: '2026-05-11T15:00:00',
			},
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(tzidFromParams(dtStart.params)).toBe('Europe/Warsaw');
		expect(dtStart.value).toBe('20260511T140000');
		expect(lastProp('UID', result.calendar)?.value).toBe('rich-event-uid@example.com');
	});

	it('applies timezone overlay when timezone field is set', () => {
		const timed = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tz@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Meet
DTSTART:20260511T100000Z
DTEND:20260511T110000Z
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(timed);
		const result = patchEventCalendar(
			ast,
			{ timezone: 'Europe/Berlin' },
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(tzidFromParams(dtStart.params)).toBe('Europe/Berlin');
		// 10:00 UTC on 2026-05-11 → 12:00 CEST in Europe/Berlin
		expect(dtStart.value).toBe('20260511T120000');
		expect(lastProp('DTEND', result.calendar)?.value).toBe('20260511T130000');
	});

	it('converts UTC Z start/end to wall-clock when preserving TZID', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(
			ast,
			{
				start: '2026-05-11T12:00:00.000Z',
				end: '2026-05-11T13:00:00.000Z',
			},
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(tzidFromParams(dtStart.params)).toBe('Europe/Warsaw');
		// 12:00 UTC → 14:00 CEST in Europe/Warsaw
		expect(dtStart.value).toBe('20260511T140000');
		expect(lastProp('DTEND', result.calendar)?.value).toBe('20260511T150000');
	});

	it('treats empty timezone as omit (keeps current TZID)', () => {
		const ast = parseIcs(RICH_ICS);
		const result = patchEventCalendar(ast, { timezone: '' }, { now: FIXED_NOW });

		expect(result.changed).toBe(false);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(tzidFromParams(dtStart.params)).toBe('Europe/Warsaw');
		expect(dtStart.value).toBe('20260511T100000');
	});

	it('setProp replaces the last duplicate property (matches lastProp)', () => {
		const dupes = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:dup@example.com
DTSTAMP:20260101T100000Z
SUMMARY:First
SUMMARY:Last
DTSTART:20260511T100000Z
DTEND:20260511T110000Z
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(dupes);
		const result = patchEventCalendar(ast, { summary: 'Patched' }, { now: FIXED_NOW });
		const vevent = findFirstVEvent(result.calendar)!;
		const summaries = vevent.properties.filter((p) => p.name.toUpperCase() === 'SUMMARY');
		expect(summaries).toHaveLength(2);
		expect(summaries[0].value).toBe('First');
		expect(summaries[1].value).toBe('Patched');
		expect(lastProp('SUMMARY', result.calendar)?.value).toBe('Patched');
	});

	it('preserves LANGUAGE/ALTREP params when patching SUMMARY/DESCRIPTION/LOCATION', () => {
		const withParams = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:params@example.com
DTSTAMP:20260101T100000Z
SUMMARY;LANGUAGE=en:Old
DESCRIPTION;ALTREP="CID:desc":Keep params
LOCATION;LANGUAGE=pl:HQ
DTSTART:20260511T100000Z
DTEND:20260511T110000Z
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(withParams);
		patchEventCalendar(
			ast,
			{ summary: 'New', description: 'Updated', location: 'Office' },
			{ now: FIXED_NOW },
		);

		const summary = lastProp('SUMMARY', ast)!;
		expect(summary.value).toBe('New');
		expect(summary.params).toEqual([{ name: 'LANGUAGE', value: 'en' }]);
		const description = lastProp('DESCRIPTION', ast)!;
		expect(description.value).toBe('Updated');
		expect(description.params.some((p) => p.name.toUpperCase() === 'ALTREP')).toBe(true);
		const location = lastProp('LOCATION', ast)!;
		expect(location.value).toBe('Office');
		expect(location.params).toEqual([{ name: 'LANGUAGE', value: 'pl' }]);
	});

	it('rejects date/timezone patches on DURATION-only events with a clear error', () => {
		const durationOnly = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:duration@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Dur
DTSTART:20260511T100000Z
DURATION:PT1H
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(durationOnly);
		expect(() =>
			patchEventCalendar(ast, { timezone: 'Europe/Berlin' }, { now: FIXED_NOW }),
		).toThrow(/DURATION instead of DTEND/);
	});

	it('writes DTEND and removes DURATION when End is provided on a DURATION-only event', () => {
		const durationOnly = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:duration@end@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Dur
DTSTART:20260511T100000Z
DURATION:PT1H
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(durationOnly);
		const result = patchEventCalendar(
			ast,
			{ end: '2026-05-11T12:00:00.000Z' },
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		expect(lastProp('DTEND', result.calendar)?.value).toBe('20260511T120000Z');
		expect(lastProp('DURATION', result.calendar)).toBeUndefined();
		expect(serializeIcs(result.calendar)).not.toMatch(/DURATION:/);
	});

	it('rejects turning off All Day without Start and End', () => {
		const allDay = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Day
DTSTART;VALUE=DATE:20260511
DTEND;VALUE=DATE:20260512
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(allDay);
		expect(() =>
			patchEventCalendar(ast, { allDay: false }, { now: FIXED_NOW }),
		).toThrow(/Cannot turn off All Day without Start and End/);
	});

	it('converts all-day to timed when Start and End are provided', () => {
		const allDay = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday-timed@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Day
DTSTART;VALUE=DATE:20260511
DTEND;VALUE=DATE:20260512
END:VEVENT
END:VCALENDAR`;

		const ast = parseIcs(allDay);
		const result = patchEventCalendar(
			ast,
			{
				allDay: false,
				start: '2026-05-11T09:00:00.000Z',
				end: '2026-05-11T10:00:00.000Z',
			},
			{ now: FIXED_NOW },
		);

		expect(result.changed).toBe(true);
		const dtStart = lastProp('DTSTART', result.calendar)!;
		expect(dtStart.params.some((p) => p.name.toUpperCase() === 'VALUE')).toBe(false);
		expect(dtStart.value).toBe('20260511T090000Z');
		expect(lastProp('DTEND', result.calendar)?.value).toBe('20260511T100000Z');
	});

	it('keeps UID stable across patch', () => {
		const ast = parseIcs(RICH_ICS);
		patchEventCalendar(ast, { summary: 'x', location: 'y' }, { now: FIXED_NOW });
		expect(lastProp('UID', ast)?.value).toBe('rich-event-uid@example.com');
	});
});
