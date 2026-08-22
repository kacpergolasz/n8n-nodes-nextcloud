import type { NextcloudRequestContext } from '../../shared/requestContext';
import { FilesClient } from '../files.client';

function n8nContext(
	httpRequestWithAuthentication: ReturnType<typeof vi.fn>,
	baseUrl = 'https://cloud.example.com',
	username = 'alice',
): NextcloudRequestContext {
	return {
		getCredentials: async () => ({
			baseUrl,
			username,
			appPassword: 'secret',
		}),
		helpers: { httpRequestWithAuthentication },
	} as never;
}

describe('FilesClient.fromN8nContext', () => {
	it('builds host-relative OCS URLs from the credential base URL', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => ({
			ocs: { meta: { status: 'ok', statuscode: 100 }, data: [] },
		}));
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const client = await FilesClient.fromN8nContext(
			n8nContext(httpRequestWithAuthentication, 'https://cloud.example.com/'),
		);
		const result = await client.get(
			'/ocs/v2.php/apps/files_sharing/api/v1/shares',
			{ format: 'json' },
			{ 'OCS-APIRequest': 'true', Accept: 'application/json' },
			{ json: true, ignoreHttpStatusErrors: true },
		);

		expect(result.success).toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://cloud.example.com/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json',
				json: true,
				ignoreHttpStatusErrors: true,
			}),
		);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).not.toHaveProperty('Authorization');

		vi.unstubAllGlobals();
	});

	it('accepts absolute WebDAV URLs for PROPFIND', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => '<d:multistatus/>');
		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const url = 'https://cloud.example.com/remote.php/dav/files/alice/Documents';

		const result = await client.propfind(url, '<d:propfind/>', {
			Depth: '1',
			'Content-Type': 'application/xml; charset=utf-8',
		});

		expect(result).toEqual({ success: true, response: '<d:multistatus/>' });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'PROPFIND',
				url,
				json: false,
				headers: expect.objectContaining({ Depth: '1' }),
			}),
		);
	});

	it('formats structured HTTP errors from the n8n helper', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw Object.assign(new Error('Not Found'), { statusCode: 404 });
		});

		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.delete(
			'https://cloud.example.com/remote.php/dav/files/alice/missing.txt',
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('Files API request failed: 404 — Not Found');
			expect(result.error).toMatchObject({ statusCode: 404 });
		}
	});

	it('maps WebDAV 412 axios noise to an overwrite hint', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw Object.assign(new Error('Request failed with status code 412'), {
				statusCode: 412,
			});
		});

		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.copy(
			'https://cloud.example.com/remote.php/dav/files/alice/a.txt',
			{
				Destination: 'https://cloud.example.com/remote.php/dav/files/alice/b.txt',
				Overwrite: 'F',
			},
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe(
				'Files API request failed: 412 — Destination already exists. Enable Overwrite, or choose a different destination path.',
			);
			expect(result.error).toMatchObject({ statusCode: 412 });
		}
	});

	it('includes OCS meta messages in formatted errors', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw {
				statusCode: 404,
				response: {
					body: {
						ocs: { meta: { status: 'failure', statuscode: 404, message: 'Share not found' } },
					},
				},
			};
		});

		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.get('/ocs/v2.php/apps/files_sharing/api/v1/shares/9', undefined, undefined, {
			json: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('Files API request failed: 404 — Share not found');
		}
	});

	it('rejects a missing credential base URL', async () => {
		const context = {
			getCredentials: async () => ({ username: 'alice', appPassword: 'secret' }),
			helpers: { httpRequestWithAuthentication: vi.fn() },
		} as never;

		await expect(FilesClient.fromN8nContext(context)).rejects.toThrow('Base URL is required');
	});

	it('rejects a missing credential username', async () => {
		const context = {
			getCredentials: async () => ({
				baseUrl: 'https://cloud.example.com',
				appPassword: 'secret',
			}),
			helpers: { httpRequestWithAuthentication: vi.fn() },
		} as never;

		await expect(FilesClient.fromN8nContext(context)).rejects.toThrow('Username is required');
	});

	it('supports arraybuffer encoding for downloads', async () => {
		const bytes = Buffer.from([0x00, 0x01]);
		const httpRequestWithAuthentication = vi.fn(async () => bytes);
		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));

		const result = await client.get(
			'https://cloud.example.com/remote.php/dav/files/alice/a.bin',
			undefined,
			{},
			{ json: false, encoding: 'arraybuffer' },
		);

		expect(result).toEqual({ success: true, response: bytes });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				json: false,
				encoding: 'arraybuffer',
			}),
		);
	});

	it('sends Destination and Overwrite headers for MOVE', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => undefined);
		const client = await FilesClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));

		await client.move('https://cloud.example.com/remote.php/dav/files/alice/a.txt', {
			Destination: 'https://cloud.example.com/remote.php/dav/files/alice/b.txt',
			Overwrite: 'F',
		});

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'MOVE',
				headers: expect.objectContaining({
					Destination: 'https://cloud.example.com/remote.php/dav/files/alice/b.txt',
					Overwrite: 'F',
				}),
			}),
		);
	});
});
