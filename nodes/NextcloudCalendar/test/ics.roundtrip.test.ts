import {
	buildICalendarPayload,
	escapeIcsTextValue,
	findFirstVEvent,
	foldIcsLine,
	parseIcs,
	parseIcsEventVerbose,
	serializeIcs,
	unescapeIcsText,
	unfoldIcsContent,
} from '../ics';

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

const ALL_DAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day@example.com
DTSTAMP:20260101T100000Z
SUMMARY:Holiday
DTSTART;VALUE=DATE:20260510
DTEND;VALUE=DATE:20260511
END:VEVENT
END:VCALENDAR`;

describe('Calendar ICS translator round-trip', () => {
	it('preserves VALARM, RRULE, X-*, UID, ATTENDEE, and VTIMEZONE', () => {
		const ast = parseIcs(RICH_ICS);
		const roundTripped = parseIcs(serializeIcs(ast));

		expect(roundTripped.name.toUpperCase()).toBe('VCALENDAR');
		expect(roundTripped.components.some((c) => c.name.toUpperCase() === 'VTIMEZONE')).toBe(true);

		const vevent = findFirstVEvent(roundTripped);
		expect(vevent).toBeDefined();
		expect(vevent!.properties.find((p) => p.name.toUpperCase() === 'UID')?.value).toBe(
			'rich-event-uid@example.com',
		);
		expect(vevent!.properties.find((p) => p.name.toUpperCase() === 'RRULE')?.value).toBe(
			'FREQ=WEEKLY;BYDAY=MO',
		);
		expect(vevent!.properties.find((p) => p.name.toUpperCase() === 'X-CUSTOM-PROP')?.value).toBe(
			'preserve-me',
		);
		expect(
			vevent!.properties.filter((p) => p.name.toUpperCase() === 'ATTENDEE').map((p) => p.value),
		).toEqual(['mailto:a@example.com']);
		expect(vevent!.components.some((c) => c.name.toUpperCase() === 'VALARM')).toBe(true);

		const alarm = vevent!.components.find((c) => c.name.toUpperCase() === 'VALARM')!;
		expect(alarm.properties.find((p) => p.name.toUpperCase() === 'TRIGGER')?.value).toBe('-PT15M');
	});

	it('round-trips VALUE=DATE all-day events', () => {
		const ast = parseIcs(ALL_DAY_ICS);
		const serialized = serializeIcs(ast);
		expect(serialized).toMatch(/DTSTART;VALUE=DATE:20260510/);
		expect(serialized).toMatch(/DTEND;VALUE=DATE:20260511/);

		const again = parseIcs(serialized);
		const vevent = findFirstVEvent(again)!;
		const dtStart = vevent.properties.find((p) => p.name.toUpperCase() === 'DTSTART')!;
		expect(dtStart.params.some((p) => p.name.toUpperCase() === 'VALUE' && p.value === 'DATE')).toBe(
			true,
		);
		expect(dtStart.value).toBe('20260510');
	});

	it('round-trips TZID on DTSTART/DTEND', () => {
		const ast = parseIcs(RICH_ICS);
		const vevent = findFirstVEvent(ast)!;
		const dtStart = vevent.properties.find((p) => p.name.toUpperCase() === 'DTSTART')!;
		expect(dtStart.params.find((p) => p.name.toUpperCase() === 'TZID')?.value).toBe('Europe/Warsaw');
		expect(dtStart.value).toBe('20260511T100000');

		const serialized = serializeIcs(ast);
		expect(serialized).toMatch(/DTSTART;TZID=Europe\/Warsaw:20260511T100000/);
		expect(serialized).toMatch(/DTEND;TZID=Europe\/Warsaw:20260511T110000/);
	});

	it('folds long lines and unfolds on parse', () => {
		const longSummary = 'S'.repeat(100);
		const line = `SUMMARY:${longSummary}`;
		const folded = foldIcsLine(line);
		expect(folded).toContain('\r\n ');
		expect(unfoldIcsContent(folded)).toBe(line);

		const ics = [
			'BEGIN:VCALENDAR',
			'BEGIN:VEVENT',
			`UID:fold@example.com`,
			folded,
			'DTSTART:20260510T090000Z',
			'DTEND:20260510T100000Z',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n');

		const vevent = findFirstVEvent(parseIcs(ics))!;
		expect(vevent.properties.find((p) => p.name.toUpperCase() === 'SUMMARY')?.value).toBe(
			longSummary,
		);
	});

	it('escapes TEXT specials on create serialize', () => {
		const payload = buildICalendarPayload({
			summary: 'A, B; C\\D',
			description: 'line1\nline2',
			location: 'Room 1',
			start: '2026-05-10T09:00:00Z',
			end: '2026-05-10T09:30:00Z',
		});

		expect(payload).toContain('SUMMARY:A\\, B\\; C\\\\D');
		expect(payload).toContain('DESCRIPTION:line1\\nline2');
		expect(payload).toContain('LOCATION:Room 1');
		expect(unescapeIcsText(escapeIcsTextValue('a,b;c'))).toBe('a,b;c');
	});

	it('omits empty optional DESCRIPTION/LOCATION on create serialize', () => {
		const payload = buildICalendarPayload({
			summary: 'Bare',
			start: '2026-05-10T09:00:00Z',
			end: '2026-05-10T09:30:00Z',
		});

		expect(payload).toContain('SUMMARY:Bare');
		expect(payload).not.toMatch(/DESCRIPTION:/);
		expect(payload).not.toMatch(/LOCATION:/);
	});

	it('projects verbose Get JSON without exposing UID (VALARM stripped from projection)', () => {
		const projected = parseIcsEventVerbose(RICH_ICS);
		expect(projected).not.toHaveProperty('uid');
		expect(projected.summary).toBe('Rich, Event');
		expect(projected.location).toBe('HQ');
		expect(projected.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=MO');
		expect(projected.start_tzid).toBe('Europe/Warsaw');
		expect(projected.attendees).toEqual(['mailto:a@example.com']);
	});
});
