import type { IExecuteFunctions } from 'n8n-workflow';

import { buildListEventsRequest, eventGetAll } from '../resources/event/getAll';

describe('buildListEventsRequest', () => {
	it('uses PROPFIND when no time bounds are set', () => {
		const req = buildListEventsRequest(null, null);
		expect(req.method).toBe('PROPFIND');
		expect(req.body).toContain('d:propfind');
		expect(req.body).not.toContain('time-range');
	});

	it('uses REPORT calendar-query with time-range when bounds are set', () => {
		const after = Date.parse('2026-07-01T00:00:00.000Z');
		const before = Date.parse('2026-07-31T23:59:59.000Z');
		const req = buildListEventsRequest(after, before);

		expect(req.method).toBe('REPORT');
		expect(req.body).toContain('calendar-query');
		expect(req.body).toContain('start="20260701T000000Z"');
		// end is exclusive in CalDAV; inclusive Before is expressed as +1s
		expect(req.body).toContain('end="20260801T000000Z"');
	});

	it('allows open-ended after-only and before-only ranges', () => {
		const afterOnly = buildListEventsRequest(Date.parse('2026-07-01T00:00:00.000Z'), null);
		expect(afterOnly.body).toContain('start="20260701T000000Z"');
		expect(afterOnly.body).not.toMatch(/\send="/);

		const beforeOnly = buildListEventsRequest(null, Date.parse('2026-07-01T00:00:00.000Z'));
		expect(beforeOnly.body).toContain('end="20260701T000001Z"');
		expect(beforeOnly.body).not.toMatch(/\sstart="/);
	});
});

describe('eventGetAll date filters', () => {
	it('applies After/Before against DTSTART (Date objects from n8n dateTime)', async () => {
		const after = new Date('2026-06-01T00:00:00.000Z');
		const before = new Date('2026-06-30T23:59:59.000Z');

		const multistatus = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/remote.php/dav/calendars/alice/personal/in-range.ics</d:href>
    <d:propstat><d:prop>
      <cal:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260615T100000Z
SUMMARY:In range
END:VEVENT
END:VCALENDAR</cal:calendar-data>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/calendars/alice/personal/out-of-range.ics</d:href>
    <d:propstat><d:prop>
      <cal:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260501T100000Z
SUMMARY:Too early
END:VEVENT
END:VCALENDAR</cal:calendar-data>
    </d:prop></d:propstat>
  </d:response>
</d:multistatus>`;

		const httpRequestWithAuthentication = vi.fn(async () => multistatus);
		const context = {
			getNodeParameter: vi.fn((name: string, _index?: number, defaultValue?: unknown) => {
				if (name === 'returnAll') return true;
				if (name === 'limit') return 10;
				if (name === 'after') return after;
				if (name === 'before') return before;
				if (name === 'authentication') return 'basicAuth';
				return defaultValue ?? '';
			}),
			helpers: { httpRequestWithAuthentication },
		} as unknown as IExecuteFunctions;

		const items = await eventGetAll(context, {
			itemIndex: 0,
			credentials: {
				baseUrl: 'https://cloud.example.com',
				username: 'alice',
				credentialName: 'nextcloudApi',
				authentication: 'basicAuth',
				appPassword: 'secret',
			},
			calendarUrl: 'https://cloud.example.com/remote.php/dav/calendars/alice/personal/',
			calendarId: 'personal',
			userId: 'alice',
		});

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'REPORT',
				body: expect.stringContaining('time-range'),
			}),
		);
		expect(items).toHaveLength(1);
		expect(items[0].json.eventId).toBe('in-range');
		expect(items[0].json.summary).toBe('In range');
	});
});
