import { validateSharePassword } from '../GenericFunctions';
import type { NextcloudRequestContext } from '../../shared/requestContext';

function makeContext(
	httpRequestWithAuthentication: ReturnType<typeof vi.fn>,
): NextcloudRequestContext {
	return {
		getCredentials: async () => ({
			baseUrl: 'https://cloud.example.com',
			username: 'alice',
			appPassword: 'secret',
		}),
		helpers: {
			httpRequestWithAuthentication,
		},
	} as unknown as NextcloudRequestContext;
}

describe('validateSharePassword', () => {
	it('fail-opens when password_policy endpoint returns 404', async () => {
		const http = vi.fn().mockRejectedValue({ statusCode: 404, message: 'Not found' });
		await expect(validateSharePassword(makeContext(http), 'LiveTestPw1!')).resolves.toBeUndefined();
	});

	it('fail-closes on transport/5xx errors', async () => {
		const http = vi.fn().mockRejectedValue({ statusCode: 503, message: 'Unavailable' });
		await expect(validateSharePassword(makeContext(http), 'LiveTestPw1!')).resolves.toMatch(
			/Could not validate share password.*HTTP 503/,
		);
	});

	it('fail-closes when the request fails without a status code', async () => {
		const http = vi.fn().mockRejectedValue(new Error('network down'));
		await expect(validateSharePassword(makeContext(http), 'LiveTestPw1!')).resolves.toMatch(
			/Could not validate share password against the server password policy/,
		);
	});

	it('returns policy reason when validation fails', async () => {
		const http = vi.fn().mockResolvedValue({
			ocs: {
				meta: { status: 'ok', statuscode: 200 },
				data: { passed: false, reason: 'Password too short' },
			},
		});
		await expect(validateSharePassword(makeContext(http), 'short')).resolves.toBe(
			'Password too short',
		);
	});
});
