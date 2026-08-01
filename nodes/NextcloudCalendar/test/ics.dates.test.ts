import { describe, expect, it } from 'vitest';

import { isoToIcsDateTime } from '../ics/dates';

describe('isoToIcsDateTime', () => {
	it('converts typical n8n UTC dateTime (ms + Z)', () => {
		expect(isoToIcsDateTime('2026-05-10T09:00:00.000Z')).toBe('20260510T090000Z');
	});

	it('converts offset ISO to UTC Z DATE-TIME', () => {
		expect(isoToIcsDateTime('2026-05-10T09:00:00+02:00')).toBe('20260510T070000Z');
		expect(isoToIcsDateTime('2026-05-10T09:00:00-05:00')).toBe('20260510T140000Z');
	});

	it('normalizes fractional seconds longer than ms', () => {
		expect(isoToIcsDateTime('2026-05-10T09:00:00.123456Z')).toBe('20260510T090000Z');
	});

	it('keeps floating wall-clock without Z', () => {
		expect(isoToIcsDateTime('2026-05-10T09:00:00')).toBe('20260510T090000');
	});

	it('rejects invalid input', () => {
		expect(() => isoToIcsDateTime('not-a-dateZ')).toThrow(/Invalid datetime/);
		expect(() => isoToIcsDateTime('2026-05-10')).toThrow(/Invalid floating datetime/);
	});
});
