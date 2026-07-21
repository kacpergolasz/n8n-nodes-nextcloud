import {
	nodeApiErrorPayload,
	parseLocatorParamValue,
	parseNextcloudCredentials,
	parsePositiveInt,
} from '../parse';

describe('parseNextcloudCredentials', () => {
	it('accepts a valid basic-auth credential bag', () => {
		expect(
			parseNextcloudCredentials({
				baseUrl: 'https://cloud.example.com',
				username: 'alice',
				appPassword: 'secret',
			}),
		).toEqual({
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			appPassword: 'secret',
		});
	});

	it('rejects missing fields with a user-facing message', () => {
		expect(() =>
			parseNextcloudCredentials({
				baseUrl: 'https://cloud.example.com',
				username: '',
				appPassword: 'secret',
			}),
		).toThrow('Username is required');
	});
});

describe('nodeApiErrorPayload', () => {
	it('builds a JsonObject-compatible payload without casts', () => {
		expect(nodeApiErrorPayload('Request failed')).toEqual({ message: 'Request failed' });
		expect(nodeApiErrorPayload('Gone', { httpCode: 410 })).toEqual({
			message: 'Gone',
			httpCode: 410,
		});
	});
});

describe('parsePositiveInt', () => {
	it('accepts numeric strings and rejects non-integers', () => {
		expect(parsePositiveInt('42', 'Share ID')).toBe(42);
		expect(() => parsePositiveInt(3.5, 'Share ID')).toThrow('Share ID must be a positive integer');
		expect(() => parsePositiveInt('', 'Share ID')).toThrow('Share ID is required');
	});
});

describe('parseLocatorParamValue', () => {
	it('extracts scalars and RLC value fields', () => {
		expect(parseLocatorParamValue(' /Documents ')).toBe('/Documents');
		expect(parseLocatorParamValue({ mode: 'list', value: '12' })).toBe('12');
		expect(parseLocatorParamValue({ mode: 'list', value: '' })).toBeUndefined();
		expect(parseLocatorParamValue(null)).toBeUndefined();
	});
});
