import type { NewsClient } from '../news.client';
import {
	createFeed,
	getFavicon,
	getFeeds,
	newsFeedSchema,
} from '../repositories/NewsFeed.repository';

const liveFeed = {
	id: 39,
	url: 'http://feeds.feedburner.com/oatmealfeed',
	title: 'The Oatmeal',
	faviconLink: 'http://theoatmeal.com/favicon.ico',
	added: 1367063790,
	folderId: 4,
	unreadCount: 9,
	link: 'http://theoatmeal.com/',
	pinned: true,
};

describe('newsFeedSchema', () => {
	it('accepts live feed payloads', () => {
		expect(newsFeedSchema.parse(liveFeed)).toMatchObject({
			id: 39,
			url: liveFeed.url,
			title: liveFeed.title,
			folderId: 4,
		});
	});

	it('accepts null counters from live create responses', () => {
		expect(
			newsFeedSchema.parse({
				...liveFeed,
				nextUpdateTime: null,
				unreadCount: null,
				ordering: null,
				updateErrorCount: null,
			}),
		).toMatchObject({
			id: 39,
			nextUpdateTime: null,
			unreadCount: null,
		});
	});
});

describe('getFeeds', () => {
	it('unwraps a feeds envelope', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: { feeds: [liveFeed], starredCount: 2, newestItemId: 3443 },
			})),
		};

		const result = await getFeeds(client as unknown as NewsClient);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response).toHaveLength(1);
			expect(result.response[0].id).toBe(39);
		}
	});
});

describe('createFeed', () => {
	it('returns the first feed from a create envelope', async () => {
		const client = {
			post: vi.fn(async () => ({
				success: true as const,
				response: { feeds: [liveFeed], newestItemId: 23 },
			})),
		};

		const result = await createFeed(client as unknown as NewsClient, {
			url: liveFeed.url,
			folderId: 4,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.response.id).toBe(39);
		}
		expect(client.post).toHaveBeenCalledWith('/feeds', {
			url: liveFeed.url,
			folderId: 4,
		});
	});
});

describe('getFavicon', () => {
	it('parses arraybuffer responses into a Buffer', async () => {
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const client = {
			get: vi.fn(async () => ({ success: true as const, response: bytes })),
		};

		const result = await getFavicon(client as unknown as NewsClient, {
			feedUrlHash: 'abc',
		});

		expect(result).toEqual({ success: true, response: bytes });
		expect(client.get).toHaveBeenCalledWith('/favicon/abc', undefined, undefined, {
			json: false,
			encoding: 'arraybuffer',
		});
	});

	it('passes through client failures', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: false as const,
				error: new Error('News API request failed: 404'),
			})),
		};

		const result = await getFavicon(client as unknown as NewsClient, {
			feedUrlHash: 'missing',
		});
		expect(result.success).toBe(false);
	});
});
