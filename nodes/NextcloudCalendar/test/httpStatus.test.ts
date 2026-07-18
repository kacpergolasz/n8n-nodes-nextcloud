import { getHttpStatusCode } from '../shared/httpStatus';

describe('getHttpStatusCode', () => {
	it('reads statusCode / httpCode / status', () => {
		expect(getHttpStatusCode({ statusCode: 404 })).toBe(404);
		expect(getHttpStatusCode({ httpCode: '404' })).toBe(404);
		expect(getHttpStatusCode({ status: 500 })).toBe(500);
	});

	it('reads nested response status', () => {
		expect(getHttpStatusCode({ response: { statusCode: 404 } })).toBe(404);
		expect(getHttpStatusCode({ response: { status: 404 } })).toBe(404);
	});

	it('reads cause chain', () => {
		expect(getHttpStatusCode({ cause: { statusCode: 404 } })).toBe(404);
	});

	it('returns undefined when absent', () => {
		expect(getHttpStatusCode(new Error('boom'))).toBeUndefined();
		expect(getHttpStatusCode(null)).toBeUndefined();
	});
});
