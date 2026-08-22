import type { NewsClient } from '../news.client';
import {
	getItems,
	markItemAction,
	markItemsMultiple,
	newsItemSchema,
} from '../repositories/NewsItem.repository';

const liveItem = {
	id: 3443,
	guid: 'http://example.com/?p=76',
	guidHash: '3059047a572cd9cd5d0bf645faffd077',
	url: 'http://example.com/article',
	title: 'Plasma-nm after the solid sprint',
	author: 'Jan Grulich',
	pubDate: 1367270544,
	body: '<p>At first I have to say...</p>',
	feedId: 67,
	unread: true,
	starred: false,
	lastModified: 1367273003,
};

describe('newsItemSchema', () => {
	it('accepts live item payloads', () => {
		expect(newsItemSchema.parse(liveItem)).toMatchObject({
			id: 3443,
			feedId: 67,
			unread: true,
		});
	});

	it('accepts string lastModified values from the type table', () => {
		expect(
			newsItemSchema.parse({ ...liveItem, lastModified: '0' }),
		).toMatchObject({ lastModified: '0' });
	});
});

describe('getItems', () => {
	it('unwraps an items envelope and forwards query options', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: { items: [liveItem] },
			})),
		};

		const result = await getItems(client as unknown as NewsClient, {
			batchSize: 10,
			offset: 0,
			type: 3,
			id: 0,
			getRead: false,
		});

		expect(result).toEqual({
			success: true,
			response: [expect.objectContaining({ id: 3443 })],
		});
		expect(client.get).toHaveBeenCalledWith('/items', {
			batchSize: 10,
			offset: 0,
			type: 3,
			id: 0,
			getRead: false,
		});
	});

	it('rejects an unrecognized envelope', async () => {
		const client = {
			get: vi.fn(async () => ({
				success: true as const,
				response: { items: {} },
			})),
		};

		const result = await getItems(client as unknown as NewsClient);
		expect(result.success).toBe(false);
	});
});

describe('markItemAction / markItemsMultiple', () => {
	it('posts single-item actions', async () => {
		const client = {
			post: vi.fn(async () => ({ success: true as const, response: undefined })),
		};

		const result = await markItemAction(client as unknown as NewsClient, {
			itemId: 3443,
			action: 'read',
		});

		expect(result).toEqual({ success: true, response: null });
		expect(client.post).toHaveBeenCalledWith('/items/3443/read');
	});

	it('posts bulk actions with itemIds', async () => {
		const client = {
			post: vi.fn(async () => ({ success: true as const, response: undefined })),
		};

		const result = await markItemsMultiple(client as unknown as NewsClient, {
			action: 'star',
			itemIds: [1, 2],
		});

		expect(result).toEqual({ success: true, response: null });
		expect(client.post).toHaveBeenCalledWith('/items/star/multiple', { itemIds: [1, 2] });
	});
});
