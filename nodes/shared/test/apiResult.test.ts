import { z } from 'zod';

import { parseEmpty, parseWith, unwrapResult, type Maybe } from '../apiResult';

describe('parseWith', () => {
	const schema = z.object({ id: z.number(), title: z.string() });

	it('parses a successful client response against the schema', () => {
		const result = parseWith({ success: true, response: { id: 1, title: 'Board' } }, schema);
		expect(result).toEqual({
			success: true,
			response: { id: 1, title: 'Board' },
		});
	});

	it('passes through a failed client result without parsing', () => {
		const error = new Error('Deck API request failed: 403');
		const result = parseWith({ success: false, error }, schema);
		expect(result).toEqual({ success: false, error });
	});

	it('returns a failure when the schema does not match', () => {
		const result = parseWith({ success: true, response: { id: 'x', title: 1 } }, schema);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeInstanceOf(Error);
		}
	});
});

describe('parseEmpty', () => {
	it('accepts undefined and empty object bodies', () => {
		expect(parseEmpty({ success: true, response: undefined })).toEqual({
			success: true,
			response: null,
		});
		expect(parseEmpty({ success: true, response: {} })).toEqual({
			success: true,
			response: null,
		});
	});

	it('passes through a failed client result', () => {
		const error = new Error('network');
		expect(parseEmpty({ success: false, error })).toEqual({ success: false, error });
	});

	it('rejects non-empty scalar bodies', () => {
		const result = parseEmpty({ success: true, response: 'oops' });
		expect(result.success).toBe(false);
	});
});

describe('unwrapResult', () => {
	it('returns the response on success', () => {
		const result: Maybe<{ id: number }> = { success: true, response: { id: 7 } };
		expect(unwrapResult(result)).toEqual({ id: 7 });
	});

	it('throws the wrapped Error on failure', () => {
		const error = new Error('not found');
		expect(() => unwrapResult({ success: false, error })).toThrow(error);
	});
});
