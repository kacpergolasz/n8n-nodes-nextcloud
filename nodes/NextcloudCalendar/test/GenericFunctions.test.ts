import {
	buildCalendarHomeUrl,
	buildEventUrl,
	buildICalendarPayload,
	escapeIcsTextValue,
	eventIdFromCalDavHref,
	getCredentials,
	parseCalendarsFromXml,
	icsDateOrDateTimeToIso,
	parseDtStartFromIcs,
	parseEventHrefAndIcsFromMultistatus,
	parseEventHrefsFromMultistatus,
	parseIcsEventVerbose,
	parseUserIdAndCalendarIdFromCalendarUrl,
	resolveCredentialName,
	unescapeIcsText,
	unfoldIcsContent,
	resolveCalendarPath,
	resolveCalendarUrl,
} from '../GenericFunctions';
import type { IExecuteFunctions } from 'n8n-workflow';

const CALENDARS_MULTISTATUS_XML = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/calendars/alice/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Alice Root</d:displayname>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/calendars/alice/personal/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Personal</d:displayname>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/calendars/alice/work/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Work</d:displayname>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>
`;

describe('Nextcloud Calendar GenericFunctions', () => {
	it('builds calendar home URL from credentials username', () => {
		expect(
			buildCalendarHomeUrl({
				baseUrl: 'https://cloud.example.com/',
				username: 'ncuser',
				appPassword: 'secret',
			}),
		).toEqual('https://cloud.example.com/remote.php/dav/calendars/ncuser/');
	});

	it('resolves short calendar name using credential username', () => {
		expect(resolveCalendarUrl('https://cloud.example.com', 'ncuser', 'personal')).toEqual(
			'https://cloud.example.com/remote.php/dav/calendars/ncuser/personal/',
		);
	});

	it('parses user id and calendar id from a resolved calendar URL', () => {
		expect(
			parseUserIdAndCalendarIdFromCalendarUrl(
				'https://cloud.example.com/remote.php/dav/calendars/alice/personal/',
			),
		).toEqual({ userId: 'alice', calendarId: 'personal' });

		expect(
			parseUserIdAndCalendarIdFromCalendarUrl(
				'https://cloud.example.com/remote.php/dav/calendars/user%40host.example/personal/',
			),
		).toEqual({ userId: 'user@host.example', calendarId: 'personal' });
	});

	it('resolves calendar path for relative and absolute inputs', () => {
		expect(
			resolveCalendarPath(
				'https://cloud.example.com/',
				'/remote.php/dav/calendars/alice/personal/',
			),
		).toEqual('https://cloud.example.com/remote.php/dav/calendars/alice/personal/');

		expect(
			resolveCalendarPath(
				'https://cloud.example.com',
				'https://cloud.example.com/remote.php/dav/calendars/alice/work/',
			),
		).toEqual('https://cloud.example.com/remote.php/dav/calendars/alice/work/');
	});

	it('builds event URL with .ics suffix', () => {
		expect(
			buildEventUrl('https://cloud.example.com/remote.php/dav/calendars/alice/personal/', 'abc123'),
		).toEqual('https://cloud.example.com/remote.php/dav/calendars/alice/personal/abc123.ics');
	});

	it('derives event id from CalDAV href', () => {
		expect(eventIdFromCalDavHref('/remote.php/dav/calendars/alice/personal/abc123.ics')).toBe(
			'abc123',
		);
		expect(eventIdFromCalDavHref('/remote.php/dav/calendars/alice/personal/foo%20bar.ics')).toBe(
			'foo bar',
		);
	});

	it('creates iCalendar payload with required VEVENT fields', () => {
		const payload = buildICalendarPayload({
			summary: 'Team Sync',
			description: 'Weekly sync',
			start: '2026-05-10T09:00:00Z',
			end: '2026-05-10T09:30:00Z',
		});

		expect(payload).toContain('BEGIN:VCALENDAR');
		expect(payload).toContain('BEGIN:VEVENT');
		expect(payload).toContain('SUMMARY:Team Sync');
		expect(payload).toContain('DESCRIPTION:Weekly sync');
		expect(payload).toContain('END:VCALENDAR');
	});

	it('escapes RFC 5545 TEXT specials in iCalendar payload fields', () => {
		const payload = buildICalendarPayload({
			summary: 'A, B; C\\D',
			description: 'line1\r\nline2',
			location: 'Room\n1',
			start: '2026-05-10T09:00:00Z',
			end: '2026-05-10T09:30:00Z',
		});

		expect(payload).toContain('SUMMARY:A\\, B\\; C\\\\D');
		expect(payload).toContain('DESCRIPTION:line1\\nline2');
		expect(payload).toContain('LOCATION:Room\\n1');
	});

	it('round-trips escapeIcsTextValue with unescapeIcsText', () => {
		const raw = 'a,b;c\\d\ne\rf';
		expect(unescapeIcsText(escapeIcsTextValue(raw))).toBe('a,b;c\\d\ne\nf');
	});

	it('parses calendars from CalDAV multistatus XML fixture', () => {
		const calendars = parseCalendarsFromXml(CALENDARS_MULTISTATUS_XML);

		expect(calendars).toEqual([
			{ name: 'Personal', value: '/remote.php/dav/calendars/alice/personal/' },
			{ name: 'Work', value: '/remote.php/dav/calendars/alice/work/' },
		]);
	});

	it('extracts .ics hrefs from multistatus', () => {
		const xml = `
			<d:multistatus xmlns:d="DAV:">
				<d:response><d:href>/remote.php/dav/calendars/alice/personal/a.ics</d:href></d:response>
				<d:response><d:href>/remote.php/dav/calendars/alice/personal/b.ics</d:href></d:response>
				<d:response><d:href>/remote.php/dav/calendars/alice/personal/</d:href></d:response>
			</d:multistatus>
		`;

		expect(parseEventHrefsFromMultistatus(xml)).toEqual([
			'/remote.php/dav/calendars/alice/personal/a.ics',
			'/remote.php/dav/calendars/alice/personal/b.ics',
		]);
	});

	it('unfolds folded ICS lines', () => {
		expect(unfoldIcsContent('LINE1\r\n continuation')).toBe('LINE1continuation');
		expect(unescapeIcsText('a\\,b\\;c')).toBe('a,b;c');
	});

	it('parses verbose ICS event fields (optional properties, no uid)', () => {
		const parsed = parseIcsEventVerbose(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:should-not-appear
DTSTAMP:20260101T100000Z
CREATED:20251201T090000Z
LAST-MODIFIED:20251215T120000Z
SUMMARY:Demo\\, Event
DESCRIPTION:Sample
DTSTART:20260510T090000Z
DTEND:20260510T093000Z
LOCATION:HQ
STATUS:CONFIRMED
SEQUENCE:2
CATEGORIES:Work,Meetings
ORGANIZER:mailto:boss@example.com
ATTENDEE:mailto:a@example.com
ATTENDEE:mailto:b@example.com
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
END:VCALENDAR`);

		expect(parsed).not.toHaveProperty('uid');
		expect(parsed.date_start).toBe('2026-05-10T09:00:00Z');
		expect(parsed.date_end).toBe('2026-05-10T09:30:00Z');
		expect(parsed.description).toBe('Sample');
		expect(parsed.created_at).toBe('2025-12-01T09:00:00Z');
		expect(parsed.updated_at).toBe('2025-12-15T12:00:00Z');
		expect(parsed.dtstamp).toBe('2026-01-01T10:00:00Z');
		expect(parsed.summary).toBe('Demo, Event');
		expect(parsed.location).toBe('HQ');
		expect(parsed.status).toBe('CONFIRMED');
		expect(parsed.sequence).toBe(2);
		expect(parsed.categories).toEqual(['Work', 'Meetings']);
		expect(parsed.organizer).toBe('mailto:boss@example.com');
		expect(parsed.attendees).toEqual(['mailto:a@example.com', 'mailto:b@example.com']);
		expect(parsed.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=MO');
	});

	it('parses all-day VALUE=DATE range', () => {
		const parsed = parseIcsEventVerbose(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260510
DTEND;VALUE=DATE:20260511
END:VEVENT
END:VCALENDAR`);

		expect(parsed.date_start).toBe('2026-05-10T00:00:00Z');
		expect(parsed.date_end).toBe('2026-05-11T00:00:00Z');
	});

	it('parses floating DTSTART with TZID hint', () => {
		const parsed = parseIcsEventVerbose(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=Europe/Warsaw:20260511T100000
END:VEVENT
END:VCALENDAR`);

		expect(parsed.date_start).toBe('2026-05-11T10:00:00');
		expect(parsed.start_tzid).toBe('Europe/Warsaw');
	});

	it('icsDateOrDateTimeToIso handles DATE and UTC datetime', () => {
		expect(icsDateOrDateTimeToIso(';VALUE=DATE', '20260510')).toBe('2026-05-10T00:00:00Z');
		expect(icsDateOrDateTimeToIso('', '20260510T090000Z')).toBe('2026-05-10T09:00:00Z');
	});

	it('parses DTSTART from ICS (UTC, floating, date-only)', () => {
		expect(
			parseDtStartFromIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260510T090000Z
END:VEVENT
END:VCALENDAR`),
		).toBe(Date.UTC(2026, 4, 10, 9, 0, 0, 0));

		expect(
			parseDtStartFromIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260510
END:VEVENT
END:VCALENDAR`),
		).toBe(Date.UTC(2026, 4, 10, 0, 0, 0, 0));

		expect(
			parseDtStartFromIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=Europe/Warsaw:20260510T110000
END:VEVENT
END:VCALENDAR`),
		).toBe(Date.UTC(2026, 4, 10, 11, 0, 0, 0));
	});

	it('pairs href and calendar-data from multistatus blocks', () => {
		const xml = `
			<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
				<d:response>
					<d:href>/remote.php/dav/calendars/alice/personal/a.ics</d:href>
					<d:propstat><d:prop>
						<cal:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260101T120000Z
END:VEVENT
END:VCALENDAR</cal:calendar-data>
					</d:prop></d:propstat>
				</d:response>
				<d:response>
					<d:href>/remote.php/dav/calendars/alice/personal/</d:href>
				</d:response>
			</d:multistatus>
		`;

		expect(parseEventHrefAndIcsFromMultistatus(xml)).toEqual([
			{
				href: '/remote.php/dav/calendars/alice/personal/a.ics',
				ics: `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260101T120000Z
END:VEVENT
END:VCALENDAR`,
			},
		]);
	});
});

describe('getCredentials auth mode', () => {
	function mockContext(
		authentication: string,
		expectedCredentialName: string,
		credentialData: Record<string, unknown>,
	) {
		return {
			getNodeParameter: vi.fn((name: string, _index: number, defaultValue?: string) => {
				if (name === 'authentication') return authentication;
				return defaultValue;
			}),
			getCredentials: vi.fn(async (name: string) => {
				expect(name).toBe(expectedCredentialName);
				return credentialData;
			}),
		} as unknown as IExecuteFunctions;
	}

	it('resolveCredentialName maps authentication modes', () => {
		expect(resolveCredentialName('basicAuth')).toBe('nextcloudApi');
		expect(resolveCredentialName('oAuth2')).toBe('nextcloudOAuth2Api');
		expect(resolveCredentialName('anything-else')).toBe('nextcloudApi');
	});

	it('loads nextcloudApi for basicAuth', async () => {
		const context = mockContext('basicAuth', 'nextcloudApi', {
			baseUrl: 'https://cloud.example.com/',
			username: 'ncuser',
			appPassword: 'secret',
		});

		await expect(getCredentials(context)).resolves.toEqual({
			baseUrl: 'https://cloud.example.com',
			username: 'ncuser',
			appPassword: 'secret',
			credentialName: 'nextcloudApi',
			authentication: 'basicAuth',
		});
	});

	it('loads nextcloudOAuth2Api for oAuth2', async () => {
		const context = mockContext('oAuth2', 'nextcloudOAuth2Api', {
			baseUrl: 'https://cloud.example.com',
			username: 'ncuser',
			clientSecret: 'client-secret',
			oauthTokenData: {
				access_token: 'access-tok',
				refresh_token: 'refresh-tok',
			},
		});

		await expect(getCredentials(context)).resolves.toEqual({
			baseUrl: 'https://cloud.example.com',
			username: 'ncuser',
			clientSecret: 'client-secret',
			accessToken: 'access-tok',
			refreshToken: 'refresh-tok',
			credentialName: 'nextcloudOAuth2Api',
			authentication: 'oAuth2',
		});
	});
});
