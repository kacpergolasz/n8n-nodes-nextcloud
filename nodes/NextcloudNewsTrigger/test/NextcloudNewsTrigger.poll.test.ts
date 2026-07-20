import type { IDataObject, INodeExecutionData, IPollFunctions } from 'n8n-workflow';

import {
	getCredentials,
	newsRequest,
} from '../../NextcloudNews/GenericFunctions';
import type { NewsItem, NextcloudCredentialData } from '../../NextcloudNews/NewsInterface';
import {
	LAST_TIME_CHECKED_KEY,
	PROCESSED_IDS_KEY,
} from '../../shared/pollHelpers';

import {
	POLL_ERROR_NOTICE_SHOWN_KEY,
	POLL_SCOPE_KEY,
	getPollScope,
	getProcessedArticleIds,
	isPollErrorNoticeShown,
	resolveNewsPollScope,
	runNewsPoll,
	seedNewsPollState,
} from '../pollNews';

vi.mock('../../NextcloudNews/GenericFunctions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../NextcloudNews/GenericFunctions')>();
	return {
		...actual,
		getCredentials: vi.fn(),
		newsRequest: vi.fn(),
	};
});

const CREDENTIALS: NextcloudCredentialData = {
	baseUrl: 'https://cloud.example.com',
	username: 'alice',
	appPassword: 'secret-token',
};

function article(id: number, overrides: Partial<NewsItem> = {}): NewsItem {
	return {
		id,
		title: `Article ${id}`,
		unread: true,
		feedId: 10,
		...overrides,
	};
}

type PollContextOptions = {
	mode?: 'manual' | 'trigger';
	staticData?: IDataObject;
	folderId?: string;
	feedId?: string;
	unreadOnly?: boolean;
};

function createPollContext(options: PollContextOptions = {}): IPollFunctions {
	const staticData = options.staticData ?? {};

	return {
		getMode: () => options.mode ?? 'trigger',
		getNodeParameter: (name: string) => {
			if (name === 'folder') {
				return { mode: 'id', value: options.folderId ?? '' };
			}
			if (name === 'feed') {
				return { mode: 'id', value: options.feedId ?? '' };
			}
			if (name === 'unreadOnly') {
				return options.unreadOnly ?? true;
			}
			throw new Error(`Unknown parameter: ${name}`);
		},
		getWorkflowStaticData: () => staticData,
		getNode: () => ({ name: 'Nextcloud News Trigger', type: 'nextcloudNewsTrigger' }),
		helpers: {
			returnJsonArray: (items: IDataObject[]) =>
				items.map((json) => ({ json, pairedItem: { item: 0 } })),
		},
		logger: {
			debug: vi.fn(),
		},
	} as unknown as IPollFunctions;
}

function outputTitles(result: INodeExecutionData[][] | null): string[] {
	return (result?.[0] ?? []).map((item) => String(item.json.title ?? item.json.event ?? ''));
}

function initializedStaticData(
	items: NewsItem[],
	scopeKey = 'folder:|feed:|unread:true',
): IDataObject {
	const staticData: IDataObject = {};
	seedNewsPollState(staticData, scopeKey, items, Date.parse('2026-07-20T06:00:00.000Z'));
	return staticData;
}

describe('resolveNewsPollScope', () => {
	it('defaults to all feeds (type 3) when no folder/feed selected', () => {
		expect(resolveNewsPollScope({ unreadOnly: true })).toEqual({
			type: 3,
			id: 0,
			getRead: false,
			scopeKey: 'folder:|feed:|unread:true',
		});
	});

	it('prefers feed over folder', () => {
		expect(
			resolveNewsPollScope({ folderId: 1, feedId: 67, unreadOnly: false }),
		).toEqual({
			type: 0,
			id: 67,
			getRead: true,
			scopeKey: 'folder:1|feed:67|unread:false',
		});
	});

	it('uses folder scope when feed is empty', () => {
		expect(resolveNewsPollScope({ folderId: 12, unreadOnly: true })).toEqual({
			type: 1,
			id: 12,
			getRead: false,
			scopeKey: 'folder:12|feed:|unread:true',
		});
	});
});

describe('runNewsPoll', () => {
	beforeEach(() => {
		vi.mocked(getCredentials).mockResolvedValue(CREDENTIALS);
		vi.mocked(newsRequest).mockReset();
	});

	it('seeds processed ids and scope on first poll without emitting', async () => {
		const listing = [article(101), article(100)];
		vi.mocked(newsRequest).mockResolvedValue({ items: listing });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeDefined();
		expect(getPollScope(staticData)).toBe('folder:|feed:|unread:true');
		expect(getProcessedArticleIds(staticData)).toEqual(['101', '100']);
		expect(newsRequest).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({
					type: 3,
					id: 0,
					getRead: false,
					batchSize: 100,
				}),
			}),
		);
	});

	it('pages through seed listing so backlog beyond newest 100 is marked seen', async () => {
		const page1 = Array.from({ length: 100 }, (_, i) => article(200 - i));
		const page2 = [article(100), article(99)];
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: page1 })
			.mockResolvedValueOnce({ items: page2 });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(newsRequest).toHaveBeenCalledTimes(2);
		expect(newsRequest).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ batchSize: 100, offset: 0 }),
			}),
		);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ batchSize: 100, offset: 101 }),
			}),
		);
		expect(getProcessedArticleIds(staticData)).toEqual(
			expect.arrayContaining(['200', '101', '100', '99']),
		);
		expect(getProcessedArticleIds(staticData)).toHaveLength(102);
	});

	it('uses a single page for steady-state polls after initialization', async () => {
		const existing = article(100);
		const created = article(101, { title: 'Breaking news' });
		const staticData = initializedStaticData([existing]);

		vi.mocked(newsRequest).mockResolvedValue({ items: [created, existing] });

		await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(1);
	});

	it('catch-up pages when a full newest page is all new (burst > 100)', async () => {
		const seeded = [article(50), article(49), article(48)];
		const staticData = initializedStaticData(seeded);
		const page1 = Array.from({ length: 100 }, (_, i) => article(150 - i));
		const page2 = [article(50), article(49), article(48)];

		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: page1 })
			.mockResolvedValueOnce({ items: page2 });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(2);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ offset: 51 }),
			}),
		);
		expect(result?.[0]).toHaveLength(100);
		expect(outputTitles(result)).toContain('Article 150');
		expect(outputTitles(result)).toContain('Article 51');
		expect(outputTitles(result)).not.toContain('Article 50');
		expect(getProcessedArticleIds(staticData)).toEqual(
			expect.arrayContaining(['150', '51', '50', '49', '48']),
		);
	});

	it('re-seeds without emitting when feed scope changes', async () => {
		const feedListing = [article(200, { feedId: 67 }), article(199, { feedId: 67 })];
		const staticData = initializedStaticData([article(101)]);

		vi.mocked(newsRequest).mockResolvedValue({ items: feedListing });

		const result = await runNewsPoll(
			createPollContext({
				staticData,
				feedId: '67',
				unreadOnly: true,
			}),
		);

		expect(result).toBeNull();
		expect(getPollScope(staticData)).toBe('folder:|feed:67|unread:true');
		expect(getProcessedArticleIds(staticData)).toEqual(['200', '199']);
	});

	it('re-seeds when unreadOnly filter changes', async () => {
		const listing = [article(50, { unread: false })];
		const staticData = initializedStaticData([article(101)], 'folder:|feed:|unread:true');

		vi.mocked(newsRequest).mockResolvedValue({ items: listing });

		const result = await runNewsPoll(
			createPollContext({ staticData, unreadOnly: false }),
		);

		expect(result).toBeNull();
		expect(getPollScope(staticData)).toBe('folder:|feed:|unread:false');
		expect(getProcessedArticleIds(staticData)).toEqual(['50']);
		expect(newsRequest).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ getRead: true }),
			}),
		);
	});

	it('emits full article JSON for newly seen ids after initialization', async () => {
		const existing = article(100);
		const created = article(101, { title: 'Breaking news' });
		const staticData = initializedStaticData([existing]);

		vi.mocked(newsRequest).mockResolvedValue({ items: [created, existing] });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(outputTitles(result)).toEqual(['Breaking news']);
		expect(result?.[0]?.[0]?.json).toMatchObject({
			id: 101,
			title: 'Breaking news',
			unread: true,
		});
		expect(getProcessedArticleIds(staticData)).toContain('101');
		expect(getProcessedArticleIds(staticData)).toContain('100');
	});

	it('returns null when the listing is unchanged', async () => {
		const existing = article(100);
		const staticData = initializedStaticData([existing]);

		vi.mocked(newsRequest).mockResolvedValue({ items: [existing] });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(getProcessedArticleIds(staticData)).toEqual(['100']);
	});

	it('soft-fails with one notice item and does not advance the ID window', async () => {
		const existing = article(100);
		const staticData = initializedStaticData([existing]);
		const priorIds = [...getProcessedArticleIds(staticData)];

		vi.mocked(newsRequest).mockRejectedValue(new Error('Request failed: secret-token'));

		const context = createPollContext({ staticData });
		const result = await runNewsPoll(context);

		expect(result).toHaveLength(1);
		expect(result?.[0]).toHaveLength(1);
		expect(result?.[0]?.[0]?.json).toEqual({
			event: 'pollError',
			message: 'Request failed: [REDACTED]',
		});
		expect(isPollErrorNoticeShown(staticData)).toBe(true);
		expect(getProcessedArticleIds(staticData)).toEqual(priorIds);
		expect(context.logger.debug).toHaveBeenCalledWith(
			expect.stringContaining('soft-failing poll'),
		);
		const debugMessage = String(vi.mocked(context.logger.debug).mock.calls[0]?.[0] ?? '');
		expect(debugMessage).not.toContain('secret-token');
		expect(debugMessage).toContain('[REDACTED]');
	});

	it('returns null on repeated soft-fail until a successful poll clears the notice', async () => {
		const existing = article(100);
		const staticData = initializedStaticData([existing]);
		staticData[POLL_ERROR_NOTICE_SHOWN_KEY] = true;

		vi.mocked(newsRequest).mockRejectedValue(new Error('still down'));

		const first = await runNewsPoll(createPollContext({ staticData }));
		expect(first).toBeNull();

		vi.mocked(newsRequest).mockResolvedValue({ items: [existing] });
		const recovered = await runNewsPoll(createPollContext({ staticData }));

		expect(recovered).toBeNull();
		expect(isPollErrorNoticeShown(staticData)).toBe(false);
	});

	it('throws when listing fails before initialization', async () => {
		vi.mocked(newsRequest).mockRejectedValue(new Error('Request failed: secret-token'));

		await expect(runNewsPoll(createPollContext({ staticData: {} }))).rejects.toThrow(
			/\[REDACTED\]/,
		);
	});

	it('returns null in manual mode when no articles match', async () => {
		vi.mocked(newsRequest).mockResolvedValue({ items: [] });

		await expect(runNewsPoll(createPollContext({ mode: 'manual' }))).resolves.toBeNull();
	});

	it('returns one sample article in manual mode without seeding production state', async () => {
		const listing = [article(42, { title: 'Sample' }), article(41)];
		vi.mocked(newsRequest).mockResolvedValue({ items: listing });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(createPollContext({ mode: 'manual', staticData }));

		expect(result).toHaveLength(1);
		expect(result?.[0]).toHaveLength(1);
		expect(result?.[0]?.[0]?.json).toMatchObject({
			id: 42,
			title: 'Sample',
		});
		expect(staticData[PROCESSED_IDS_KEY]).toBeUndefined();
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeUndefined();
	});

	it('passes folder scope to the items query', async () => {
		vi.mocked(newsRequest).mockResolvedValue({ items: [] });

		await runNewsPoll(createPollContext({ staticData: {}, folderId: '12' }));

		expect(newsRequest).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ type: 1, id: 12, getRead: false }),
			}),
		);
	});

	it('re-seeds when cursor exists but processed ids are missing', async () => {
		const listing = [article(5)];
		const staticData: IDataObject = {
			[LAST_TIME_CHECKED_KEY]: '2026-07-20T06:00:00.000Z',
			[POLL_SCOPE_KEY]: 'folder:|feed:|unread:true',
		};

		vi.mocked(newsRequest).mockResolvedValue({ items: listing });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(staticData[PROCESSED_IDS_KEY]).toEqual(['5']);
	});
});
