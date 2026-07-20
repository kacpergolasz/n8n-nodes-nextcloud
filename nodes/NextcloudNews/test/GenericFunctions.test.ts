import { createHash } from 'node:crypto';

import {
	buildFaviconUrl,
	buildFeedReadUrl,
	buildFeedRenameUrl,
	buildFeedUrl,
	buildFeedsUrl,
	buildFolderUrl,
	buildFoldersUrl,
	buildItemActionUrl,
	buildItemsBulkActionUrl,
	feedUrlHash,
	firstFeed,
	firstFolder,
	newsApiBase,
	parseItemIds,
	resolveFeedId,
	resolveFolderId,
	resolveItemId,
	unwrapFeeds,
	unwrapFolders,
	unwrapItems,
} from '../GenericFunctions';

const BASE = 'https://cloud.example.com';

describe('Nextcloud News GenericFunctions', () => {
	it('builds news API base URL', () => {
		expect(newsApiBase('https://cloud.example.com/')).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3',
		);
		expect(newsApiBase('https://cloud.example.com')).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3',
		);
	});

	it('builds folder and feed URLs', () => {
		expect(buildFoldersUrl(BASE)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/folders',
		);
		expect(buildFolderUrl(BASE, 12)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/folders/12',
		);
		expect(buildFeedsUrl(BASE)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/feeds',
		);
		expect(buildFeedUrl(BASE, 67)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/feeds/67',
		);
		expect(buildFeedRenameUrl(BASE, 67)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/feeds/67/rename',
		);
		expect(buildFeedReadUrl(BASE, 67)).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/feeds/67/read',
		);
	});

	it('builds item action and bulk URLs', () => {
		expect(buildItemActionUrl(BASE, 3443, 'read')).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/items/3443/read',
		);
		expect(buildItemsBulkActionUrl(BASE, 'star')).toBe(
			'https://cloud.example.com/index.php/apps/news/api/v1-3/items/star/multiple',
		);
	});

	it('hashes feed URLs with md5 for favicon routes', () => {
		const feedUrl = 'https://example.com/feed.xml';
		const expected = createHash('md5').update(feedUrl, 'utf8').digest('hex');
		expect(feedUrlHash(feedUrl)).toBe(expected);
		expect(buildFaviconUrl(BASE, expected)).toBe(
			`https://cloud.example.com/index.php/apps/news/api/v1-3/favicon/${expected}`,
		);
	});
});

describe('resolve resource ids', () => {
	it('coerces and trims ids', () => {
		expect(resolveFolderId(12)).toBe('12');
		expect(resolveFeedId(' 67 ')).toBe('67');
		expect(resolveItemId(3443)).toBe('3443');
	});

	it('rejects empty ids', () => {
		expect(() => resolveFolderId('')).toThrow('Folder id is empty.');
		expect(() => resolveFeedId('   ')).toThrow('Feed id is empty.');
		expect(() => resolveItemId('')).toThrow('Item id is empty.');
	});
});

describe('parseItemIds', () => {
	it('parses comma-separated ids', () => {
		expect(parseItemIds('1, 2, 3')).toEqual([1, 2, 3]);
	});

	it('parses JSON arrays', () => {
		expect(parseItemIds('[10, 20]')).toEqual([10, 20]);
		expect(parseItemIds([10, '20'])).toEqual([10, 20]);
	});

	it('rejects empty or invalid input', () => {
		expect(() => parseItemIds('')).toThrow('Item ids are empty.');
		expect(() => parseItemIds('1, x')).toThrow('Invalid item id: x');
	});
});

describe('unwrap helpers', () => {
	it('unwraps folders, feeds, and items envelopes', () => {
		expect(unwrapFolders({ folders: [{ id: 1, name: 'Tech' }] })).toEqual([
			{ id: 1, name: 'Tech' },
		]);
		expect(unwrapFeeds({ feeds: [{ id: 2, url: 'https://a', title: 'A' }] })).toEqual([
			{ id: 2, url: 'https://a', title: 'A' },
		]);
		expect(unwrapItems({ items: [{ id: 9, title: 'Article' }] })).toEqual([
			{ id: 9, title: 'Article' },
		]);
		expect(unwrapFolders([])).toEqual([]);
		expect(unwrapFeeds(null)).toEqual([]);
		expect(unwrapItems(null)).toEqual([]);
	});

	it('picks first created entity', () => {
		expect(firstFolder({ id: 1, name: 'Solo' })).toEqual({ id: 1, name: 'Solo' });
		expect(firstFeed({ feeds: [{ id: 2, url: 'https://a', title: 'A' }] })).toEqual({
			id: 2,
			url: 'https://a',
			title: 'A',
		});
	});
});

describe('loadFolders mapping', () => {
	it('maps folder ids to string picker values', async () => {
		const { loadFolders } = await import('../GenericFunctions');
		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: {
				httpRequestWithAuthentication: async () => ({
					folders: [
						{ id: 1, name: 'Tech' },
						{ id: 2, name: 'Sports' },
					],
				}),
			},
		};

		const folders = await loadFolders(context as never);
		expect(folders).toEqual([
			{ name: 'Tech', value: '1' },
			{ name: 'Sports', value: '2' },
		]);
	});
});

describe('loadFeeds mapping', () => {
	it('filters feeds by folder id when provided', async () => {
		const { loadFeeds } = await import('../GenericFunctions');
		const context = {
			getCredentials: async () => ({
				baseUrl: BASE,
				username: 'alice',
				appPassword: 'secret',
			}),
			helpers: {
				httpRequestWithAuthentication: async () => ({
					feeds: [
						{ id: 10, url: 'https://a', title: 'A', folderId: 1 },
						{ id: 11, url: 'https://b', title: 'B', folderId: 2 },
					],
				}),
			},
		};

		const feeds = await loadFeeds(context as never, '1');
		expect(feeds).toEqual([{ name: 'A', value: '10' }]);
	});
});
