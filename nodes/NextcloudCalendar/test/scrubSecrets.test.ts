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
});
