#!/usr/bin/env node
/**
 * Generate a structurally rich CalDAV VEVENT fixture for Phase 4 live tests.
 *
 * Usage:
 *   node test/n8n-cli/calendar/generate-rich-event.mjs
 *
 * Writes fixtures/n8n-cli-rich-partial-update.ics and prints seed curl hints.
 * Does not call Nextcloud — seed with CalDAV PUT (see README).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { faker } from '@faker-js/faker';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Fixed resource stem — workflows reference this eventId. */
const EVENT_ID = 'n8n-cli-rich-partial-update';
const UID = `${EVENT_ID}@n8n-nextcloud-live`;

function icsEscape(text) {
	return String(text)
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\n|\r/g, '\\n');
}

function toIcsDateTime(date) {
	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

const summary = faker.lorem.words({ min: 2, max: 4 });
const description = faker.lorem.sentence();
const location = faker.location.city();
const start = faker.date.soon({ days: 60 });
const end = new Date(start.getTime() + 60 * 60 * 1000);
const dtstamp = toIcsDateTime(new Date());
const dtstart = toIcsDateTime(start);
const dtend = toIcsDateTime(end);

// Structural richness is fixed; variable fields come from faker.
const ics = [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'PRODID:-//n8n//Nextcloud Calendar live fixture//EN',
	'BEGIN:VTIMEZONE',
	'TZID:Europe/Warsaw',
	'BEGIN:STANDARD',
	'DTSTART:19701025T030000',
	'TZOFFSETFROM:+0200',
	'TZOFFSETTO:+0100',
	'TZNAME:CET',
	'END:STANDARD',
	'END:VTIMEZONE',
	'BEGIN:VEVENT',
	`UID:${UID}`,
	`DTSTAMP:${dtstamp}`,
	'SEQUENCE:0',
	`SUMMARY:${icsEscape(summary)}`,
	`DESCRIPTION:${icsEscape(description)}`,
	`LOCATION:${icsEscape(location)}`,
	`DTSTART;TZID=Europe/Warsaw:${dtstart.replace(/Z$/, '')}`,
	`DTEND;TZID=Europe/Warsaw:${dtend.replace(/Z$/, '')}`,
	'RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO',
	'X-N8N-LIVE-FIXTURE:rich-partial-update',
	'ATTENDEE:mailto:live-test@example.com',
	'ORGANIZER:mailto:organizer@example.com',
	'BEGIN:VALARM',
	'ACTION:DISPLAY',
	'DESCRIPTION:Reminder',
	'TRIGGER:-PT15M',
	'END:VALARM',
	'END:VEVENT',
	'END:VCALENDAR',
	'',
].join('\r\n');

const outDir = join(__dirname, 'fixtures');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${EVENT_ID}.ics`);
writeFileSync(outPath, ics, 'utf8');

const meta = {
	eventId: EVENT_ID,
	uid: UID,
	summary,
	description,
	location,
	start: start.toISOString(),
	end: end.toISOString(),
	outPath: `fixtures/${EVENT_ID}.ics`,
};

console.log(JSON.stringify(meta, null, 2));
console.log('');
console.log('Seed (replace BASE_URL / USER / CALENDAR / AUTH):');
console.log(
	`curl -sS -u "USER:APP_PASSWORD" -X PUT \\`,
);
console.log(
	`  -H "Content-Type: text/calendar; charset=utf-8" \\`,
);
console.log(
	`  --data-binary @${meta.outPath} \\`,
);
console.log(
	`  "BASE_URL/remote.php/dav/calendars/USER/CALENDAR/${EVENT_ID}.ics"`,
);
