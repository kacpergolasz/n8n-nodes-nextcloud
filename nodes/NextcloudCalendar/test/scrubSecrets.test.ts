import { scrubErrorMessage, scrubSecrets } from '../shared/scrubSecrets';

describe('scrubSecrets', () => {
	const appPassword = 'nc-app-password-fixture';
	const username = 'ncuser';

	it('redacts appPassword from error strings', () => {
		const input = `Request failed with password ${appPassword} in body`;
		expect(scrubSecrets(input, { appPassword, username })).toBe(
			'Request failed with password [REDACTED] in body',
		);
		expect(scrubSecrets(input, { appPassword, username })).not.toContain(appPassword);
	});

	it('redacts Authorization Basic blobs', () => {
		const basic = Buffer.from(`${username}:${appPassword}`).toString('base64');
		const input = `Authorization: Basic ${basic}`;
		const scrubbed = scrubSecrets(input, { appPassword, username });
		expect(scrubbed).toBe('Authorization: Basic [REDACTED]');
		expect(scrubbed).not.toContain(basic);
		expect(scrubbed).not.toContain(appPassword);
	});

	it('redacts username:password substrings', () => {
		const input = `Failed for ${username}:${appPassword} against server`;
		const scrubbed = scrubSecrets(input, { appPassword, username });
		expect(scrubbed).toBe(`Failed for ${username}:[REDACTED] against server`);
		expect(scrubbed).not.toContain(appPassword);
	});

	it('redacts credentials embedded in URLs', () => {
		const input = `GET https://${username}:${appPassword}@cloud.example.com/remote.php/dav failed`;
		const scrubbed = scrubSecrets(input, { appPassword, username });
		expect(scrubbed).toContain(`${username}:[REDACTED]@`);
		expect(scrubbed).not.toContain(appPassword);
	});

	it('passes clean strings through unchanged', () => {
		const input = 'Calendar not found for slug personal';
		expect(scrubSecrets(input, { appPassword, username })).toBe(input);
	});

	it('scrubErrorMessage handles Error and non-Error values', () => {
		expect(
			scrubErrorMessage(new Error(`bad auth ${appPassword}`), { appPassword, username }),
		).toBe('bad auth [REDACTED]');
		expect(scrubErrorMessage(`token=${appPassword}`, { appPassword })).toBe('token=[REDACTED]');
	});

	it('redacts OAuth2 accessToken, refreshToken, and clientSecret', () => {
		const accessToken = 'oauth-access-token-fixture';
		const refreshToken = 'oauth-refresh-token-fixture';
		const clientSecret = 'oauth-client-secret-fixture';
		const input = `Failed with ${accessToken}, ${refreshToken}, and ${clientSecret}`;
		const scrubbed = scrubSecrets(input, { accessToken, refreshToken, clientSecret });
		expect(scrubbed).toBe('Failed with [REDACTED], [REDACTED], and [REDACTED]');
		expect(scrubbed).not.toContain(accessToken);
		expect(scrubbed).not.toContain(refreshToken);
		expect(scrubbed).not.toContain(clientSecret);
	});

	it('redacts Authorization Bearer blobs', () => {
		const accessToken = 'oauth-access-token-fixture';
		const input = `Authorization: Bearer ${accessToken}`;
		const scrubbed = scrubSecrets(input, { accessToken });
		expect(scrubbed).toBe('Authorization: Bearer [REDACTED]');
		expect(scrubbed).not.toContain(accessToken);
	});

	it('redacts standalone Bearer token blobs', () => {
		const accessToken = 'oauth-access-token-fixture';
		const input = `Request failed: Bearer ${accessToken} rejected`;
		const scrubbed = scrubSecrets(input, { accessToken });
		expect(scrubbed).toBe('Request failed: Bearer [REDACTED] rejected');
		expect(scrubbed).not.toContain(accessToken);
	});
});
