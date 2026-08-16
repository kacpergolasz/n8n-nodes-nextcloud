import type { NextcloudRequestContext } from '../../shared/requestContext';
import { DeckClient } from '../deck.client';

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

describe('DeckClient.fromN8nContext', () => {
	it('builds the Deck API URL from the credential base URL on context', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => [{ id: 1, title: 'Personal' }]);
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const client = await DeckClient.fromN8nContext(
			n8nContext(httpRequestWithAuthentication, 'https://cloud.example.com/'),
		);
		const result = await client.get('/boards');

		expect(result).toEqual({
			success: true,
			response: [{ id: 1, title: 'Personal' }],
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'GET',
				url: 'https://cloud.example.com/index.php/apps/deck/api/v1.0/boards',
				json: true,
				headers: {
					'OCS-APIRequest': 'true',
					'Content-Type': 'application/json',
				},
			}),
		);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).not.toHaveProperty('Authorization');

		vi.unstubAllGlobals();
	});

	it('formats structured HTTP errors from the n8n helper', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw Object.assign(new Error('Bad Request'), { statusCode: 400 });
		});

		const client = await DeckClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.put('/boards/1', { title: 'Only title' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe('Deck API request failed: 400 — Bad Request');
			expect(result.error).toMatchObject({ statusCode: 400 });
		}
	});

	it('includes Deck JSON error bodies in formatted errors', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => {
			throw {
				statusCode: 400,
				response: { body: { message: 'The user is already assigned to the card' } },
			};
		});

		const client = await DeckClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));
		const result = await client.put('/boards/1/stacks/1/cards/1/assignUser', { userId: 'alice' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe(
				'Deck API request failed: 400 — The user is already assigned to the card',
			);
		}
	});

	it('rejects a missing credential base URL', async () => {
		const context = {
			getCredentials: async () => ({ username: 'alice', appPassword: 'secret' }),
			helpers: { httpRequestWithAuthentication: vi.fn() },
		} as never;

		await expect(DeckClient.fromN8nContext(context)).rejects.toThrow('Base URL is required');
	});

	it('passes JSON bodies without Authorization so n8n injects credentials', async () => {
		const httpRequestWithAuthentication = vi.fn(async () => ({ id: 2 }));
		const client = await DeckClient.fromN8nContext(n8nContext(httpRequestWithAuthentication));

		await client.post('/boards', { title: 'Work', color: '0082c9' });

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'nextcloudApi',
			expect.objectContaining({
				method: 'POST',
				body: { title: 'Work', color: '0082c9' },
				json: true,
			}),
		);
		expect(httpRequestWithAuthentication.mock.calls[0][1].headers).not.toHaveProperty(
			'Authorization',
		);
	});
});
