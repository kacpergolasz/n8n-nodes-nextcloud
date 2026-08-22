import type { NextcloudRequestContext } from '../../shared/requestContext';
import { NewsClient } from '../news.client';

function n8nContext(
	httpRequestWithAuthentication: ReturnType<typeof vi.fn>,
	baseUrl = 'https://cloud.example.com',
): NextcloudRequestContext {
	return {
		getCredentials: async () => ({
			baseUrl,
			username: 'alice',
			appPassword: 'secret',
		}),
		helpers: { httpRequestWithAuthentication },
	} as never;
}

describe('NewsClient.fromN8nContext', () => {
	it('builds the News API URL from the credential base URL on context', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => ({ folders: [] }));
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const client = await NewsClient.fromN8nContext(
			n8nContext(httpRequestWithAuthentication, 'https://cloud.example.com/'),
		);
		const result = await client.get('/folders');

		expect(result).toEqual({
			success: true,
			response: { folders: [] },
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://cloud.example.com/index.php/apps/news/api/v1-3/folders',
				json: true,
				headers: expect.objectContaining({
					Accept: 'application/json',
					'Content-Type': 'application/json',
				}),
			}),
		);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).not.toHaveProperty('Authorization');

		vi.unstubAllGlobals();
	});

	it('formats structured HTTP errors from the n8n helper', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw Object.assign(new Error('Bad Request'), { statusCode: 400 });
		});

		const client = await NewsClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.put('/folders/1', { name: 'Only name' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('News API request failed: 400 — Bad Request');
			expect(result.error).toMatchObject({ statusCode: 400 });
		}
	});

	it('includes News JSON error bodies in formatted errors', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw {
				statusCode: 409,
				response: { body: { message: 'Folder exists already' } },
			};
		});

		const client = await NewsClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.post('/folders', { name: 'Media' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe(
				'News API request failed: 409 — Folder exists already',
			);
		}
	});

	it('rejects a missing credential base URL', async () => {
		const context = {
			getCredentials: async () => ({ username: 'alice', appPassword: 'secret' }),
			helpers: { httpRequestWithAuthentication: vi.fn() },
		} as never;

		await expect(NewsClient.fromN8nContext(context)).rejects.toThrow('Base URL is required');
	});

	it('supports non-JSON arraybuffer encoding for favicon routes', async () => {
		const bytes = Buffer.from([0x00, 0x01]);
		const httpRequestWithAuthentication = vi.fn(async () => bytes);
		const client = await NewsClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));

		const result = await client.get('/favicon/abc', undefined, undefined, {
			json: false,
			encoding: 'arraybuffer',
		});

		expect(result).toEqual({ success: true, response: bytes });
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				json: false,
				encoding: 'arraybuffer',
				headers: expect.objectContaining({ Accept: '*/*' }),
			}),
		);
	});

	it('appends query parameters to the request URL', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => ({ items: [] }));
		const client = await NewsClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));

		await client.get('/items', { batchSize: 10, offset: 0, type: 3, id: 0, getRead: false });

		expect(httpRequestWithAuthentication.mock.calls[0][1].url).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/items?batchSize=10&offset=0&type=3&id=0&getRead=false',
		);
	});
});
