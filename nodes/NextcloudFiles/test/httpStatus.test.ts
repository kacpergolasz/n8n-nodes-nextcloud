import { formatFilesErrorMessage, getHttpStatusCode } from '../shared/httpStatus';

describe('getHttpStatusCode', () => {
	it('reads status from common error shapes', () => {
		expect(getHttpStatusCode({ statusCode: 404 })).toBe(404);
		expect(getHttpStatusCode({ httpCode: '404' })).toBe(404);
		expect(getHttpStatusCode({ status: 500 })).toBe(500);
		expect(getHttpStatusCode({ response: { statusCode: 404 } })).toBe(404);
		expect(getHttpStatusCode({ cause: { statusCode: 404 } })).toBe(404);
		expect(getHttpStatusCode(new Error('boom'))).toBeUndefined();
		expect(getHttpStatusCode(null)).toBeUndefined();
	});
});

describe('formatFilesErrorMessage', () => {
	it('preserves specific OCS 404 validation messages (e.g. past expireDate)', () => {
		expect(formatFilesErrorMessage(404, 'Expiration date is in the past')).toBe(
			'Expiration date is in the past',
		);
		expect(
			formatFilesErrorMessage(404, 'Cannot set expiration date more than 30 days in the future'),
		).toBe('Cannot set expiration date more than 30 days in the future');
	});

	it('maps generic / transport 404s to Resource not found', () => {
		expect(formatFilesErrorMessage(404, 'Not found')).toBe('Resource not found (404)');
		expect(formatFilesErrorMessage(404, 'not found.')).toBe('Resource not found (404)');
		expect(formatFilesErrorMessage(404, 'Request failed with status code 404')).toBe(
			'Resource not found (404)',
		);
		expect(formatFilesErrorMessage(404, 'The resource you are requesting could not be found')).toBe(
			'Resource not found (404)',
		);
		expect(formatFilesErrorMessage(404, '')).toBe('Resource not found (404)');
	});

	it('passes through non-404 scrubbed messages', () => {
		expect(formatFilesErrorMessage(403, 'Forbidden')).toBe('Forbidden');
		expect(formatFilesErrorMessage(undefined, 'Something broke')).toBe('Something broke');
		expect(formatFilesErrorMessage(500, '   ')).toBe('Unknown error');
	});
});
