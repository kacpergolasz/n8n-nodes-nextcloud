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
	CATCH_UP_OFFSET_KEY,
	POLL_ERROR_NOTICE_SHOWN_KEY,
	POLL_SCOPE_KEY,
	TRIGGER_STEADY_MAX_PAGES,
	getCatchUpOffset,
	getMaxProcessedId,
	getPollScope,
	getProcessedArticleIds,
	isPollErrorNoticeShown,
	resolveNewsPollScope,
	resolveOptionalLocatorId,
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
	folderId?: string | number;
	feedId?: string | number;
	/** When true, folder/feed parameters are bare numbers/strings (expression results). */
	bareLocatorValues?: boolean;
	unreadOnly?: boolean;
};

function createPollContext(options: PollContextOptions = {}): IPollFunctions {
	const staticData = options.staticData ?? {};

	return {
		getMode: () => options.mode ?? 'trigger',
		getNodeParameter: (name: string) => {
			if (name === 'folder') {
				if (options.bareLocatorValues) {
					return options.folderId ?? '';
				}
				return { mode: 'id', value: options.folderId ?? '' };
			}
			if (name === 'feed') {
				if (options.bareLocatorValues) {
					return options.feedId ?? '';
				}
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

describe('resolveOptionalLocatorId', () => {
	it('reads RLC value wrappers', () => {
		const context = createPollContext({ folderId: '12', feedId: '67' });
		expect(resolveOptionalLocatorId(context, 'folder', 'Folder')).toBe(12);
		expect(resolveOptionalLocatorId(context, 'feed', 'Feed')).toBe(67);
	});

	it('coerces bare numeric expression results', () => {
		const context = createPollContext({
			folderId: 12,
			feedId: 67,
			bareLocatorValues: true,
		});
		expect(resolveOptionalLocatorId(context, 'folder', 'Folder')).toBe(12);
		expect(resolveOptionalLocatorId(context, 'feed', 'Feed')).toBe(67);
	});

	it('treats empty bare values as unset', () => {
		const context = createPollContext({ bareLocatorValues: true, folderId: '', feedId: '' });
		expect(resolveOptionalLocatorId(context, 'folder', 'Folder')).toBeUndefined();
		expect(resolveOptionalLocatorId(context, 'feed', 'Feed')).toBeUndefined();
	});
});

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
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: listing })
			.mockResolvedValueOnce({ items: listing });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(staticData[LAST_TIME_CHECKED_KEY]).toBeDefined();
		expect(getPollScope(staticData)).toBe('folder:|feed:|unread:true');
		expect(getProcessedArticleIds(staticData)).toEqual(['101', '100']);
		expect(getMaxProcessedId(staticData)).toBe(101);
		expect(newsRequest).toHaveBeenCalledTimes(2);
		expect(newsRequest).toHaveBeenNthCalledWith(
			1,
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
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({
					type: 3,
					id: 0,
					getRead: true,
					batchSize: 100,
					offset: 0,
				}),
			}),
		);
	});

	it('pages through seed listing so backlog beyond newest 100 is marked seen', async () => {
		const page1 = Array.from({ length: 100 }, (_, i) => article(200 - i));
		const page2 = [article(100), article(99)];
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: page1 })
			.mockResolvedValueOnce({ items: page2 })
			.mockResolvedValueOnce({ items: [article(200)] });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(result).toBeNull();
		expect(newsRequest).toHaveBeenCalledTimes(3);
		expect(newsRequest).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ batchSize: 100, offset: 0, getRead: false }),
			}),
		);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ batchSize: 100, offset: 101, getRead: false }),
			}),
		);
		expect(newsRequest).toHaveBeenNthCalledWith(
			3,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ batchSize: 100, offset: 0, getRead: true }),
			}),
		);
		expect(getProcessedArticleIds(staticData)).toEqual(
			expect.arrayContaining(['200', '101', '100', '99']),
		);
		expect(getProcessedArticleIds(staticData)).toHaveLength(102);
		expect(getMaxProcessedId(staticData)).toBe(200);
	});

	it('raises watermark from all-items newest page so remade-unread does not fire', async () => {
		const unreadSeed = [article(50), article(49)];
		const allNewest = [article(200, { unread: false }), article(199, { unread: false })];
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: unreadSeed })
			.mockResolvedValueOnce({ items: allNewest })
			.mockResolvedValueOnce({ items: [article(150)] });

		const staticData: IDataObject = {};
		expect(await runNewsPoll(createPollContext({ staticData }))).toBeNull();
		expect(getMaxProcessedId(staticData)).toBe(200);
		expect(getProcessedArticleIds(staticData)).toEqual(['50', '49']);

		const result = await runNewsPoll(createPollContext({ staticData }));
		expect(result).toBeNull();
		expect(getMaxProcessedId(staticData)).toBe(200);
	});

	it('still emits truly new unread articles after unread-only seed with raised watermark', async () => {
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: [article(50)] })
			.mockResolvedValueOnce({ items: [article(200, { unread: false })] })
			.mockResolvedValueOnce({ items: [article(201, { title: 'Brand new' })] });

		const staticData: IDataObject = {};
		expect(await runNewsPoll(createPollContext({ staticData }))).toBeNull();
		expect(getMaxProcessedId(staticData)).toBe(200);

		const result = await runNewsPoll(createPollContext({ staticData }));
		expect(outputTitles(result)).toEqual(['Brand new']);
		expect(getMaxProcessedId(staticData)).toBe(201);
	});

	it('skips all-items watermark fetch when seeding with unreadOnly off', async () => {
		const listing = [article(50, { unread: false })];
		vi.mocked(newsRequest).mockResolvedValue({ items: listing });

		const staticData: IDataObject = {};
		const result = await runNewsPoll(
			createPollContext({ staticData, unreadOnly: false }),
		);

		expect(result).toBeNull();
		expect(newsRequest).toHaveBeenCalledTimes(1);
		expect(newsRequest).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ getRead: true }),
			}),
		);
		expect(getMaxProcessedId(staticData)).toBe(50);
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

	it('dedupes inclusive-offset boundary id across catch-up pages', async () => {
		const seeded = [article(40)];
		const staticData = initializedStaticData(seeded);
		// Full newest page; next offset = min id = 51. Second page repeats 51 (inclusive).
		const page1 = Array.from({ length: 100 }, (_, i) => article(150 - i));
		const page2 = [article(51), article(50), article(49), article(40)];

		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: page1 })
			.mockResolvedValueOnce({ items: page2 });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(2);
		const emittedIds = (result?.[0] ?? []).map((row) => row.json.id);
		expect(emittedIds.filter((id) => id === 51)).toHaveLength(1);
		expect(emittedIds).toContain(150);
		expect(emittedIds).toContain(50);
		expect(emittedIds).toContain(49);
		expect(emittedIds).not.toContain(40);
		expect(emittedIds).toHaveLength(102);
	});

	it('catch-up continues past a second full page (burst > 200)', async () => {
		const seeded = [article(10)];
		const staticData = initializedStaticData(seeded);
		const page1 = Array.from({ length: 100 }, (_, i) => article(310 - i));
		const page2 = Array.from({ length: 100 }, (_, i) => article(211 - i));
		const page3 = [article(111), article(10)];

		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: page1 })
			.mockResolvedValueOnce({ items: page2 })
			.mockResolvedValueOnce({ items: page3 });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(3);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ offset: 211 }),
			}),
		);
		expect(newsRequest).toHaveBeenNthCalledWith(
			3,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ offset: 112 }),
			}),
		);
		const emittedIds = (result?.[0] ?? []).map((row) => row.json.id);
		expect(emittedIds).toContain(310);
		expect(emittedIds).toContain(112);
		expect(emittedIds).toContain(111);
		expect(emittedIds).not.toContain(10);
		expect(emittedIds).toHaveLength(200);
	});

	it('resumes catch-up on the next poll after hitting the per-poll page cap', async () => {
		const seeded = [article(50)];
		const staticData = initializedStaticData(seeded);
		// 10 full pages above the watermark; next cursor after page 10 is 151.
		const pages = Array.from({ length: TRIGGER_STEADY_MAX_PAGES }, (_, page) =>
			Array.from({ length: 100 }, (_, i) =>
				article(50 + (TRIGGER_STEADY_MAX_PAGES - page + 1) * 100 - i),
			),
		);

		vi.mocked(newsRequest).mockReset();
		for (const page of pages) {
			vi.mocked(newsRequest).mockResolvedValueOnce({ items: page });
		}

		const first = await runNewsPoll(createPollContext({ staticData }));
		expect(newsRequest).toHaveBeenCalledTimes(TRIGGER_STEADY_MAX_PAGES);
		expect(getCatchUpOffset(staticData)).toBe(151);
		expect(getMaxProcessedId(staticData)).toBe(50);
		const firstIds = (first?.[0] ?? []).map((row) => row.json.id);
		expect(firstIds).toContain(1150);
		expect(firstIds).toContain(151);
		expect(firstIds).not.toContain(50);
		// Oldest-new-first within the poll.
		expect(firstIds).toEqual([...firstIds].sort((a, b) => Number(a) - Number(b)));

		// Realistic resume: full inclusive page 151..52, then a page that hits W.
		const resumePage1 = Array.from({ length: 100 }, (_, i) => article(151 - i));
		const resumePage2 = [article(52), article(51), article(50)];
		vi.mocked(newsRequest).mockReset();
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: pages[0]! })
			.mockResolvedValueOnce({ items: resumePage1 })
			.mockResolvedValueOnce({ items: resumePage2 });

		const second = await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(3);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ offset: 151 }),
			}),
		);
		expect(staticData[CATCH_UP_OFFSET_KEY]).toBeUndefined();
		expect(getMaxProcessedId(staticData)).toBeGreaterThanOrEqual(1150);
		const secondIds = (second?.[0] ?? []).map((row) => row.json.id);
		expect(secondIds).toContain(100);
		expect(secondIds).toContain(51);
		expect(secondIds).not.toContain(151);
		expect(secondIds).not.toContain(50);
	});

	it('does not drop pending resume when peek returns exhausted (B1 regression)', async () => {
		const seeded = [article(50)];
		const staticData = initializedStaticData(seeded);
		const pages = Array.from({ length: TRIGGER_STEADY_MAX_PAGES }, (_, page) =>
			Array.from({ length: 100 }, (_, i) =>
				article(50 + (TRIGGER_STEADY_MAX_PAGES - page + 1) * 100 - i),
			),
		);

		vi.mocked(newsRequest).mockReset();
		for (const page of pages) {
			vi.mocked(newsRequest).mockResolvedValueOnce({ items: page });
		}
		await runNewsPoll(createPollContext({ staticData }));
		expect(getCatchUpOffset(staticData)).toBe(151);
		expect(getMaxProcessedId(staticData)).toBe(50);

		// Peek from offset 0 returns empty (exhausted) — e.g. unread-only hides
		// all articles above the gap. Resume from saved offset must still run.
		const resumePage1 = Array.from({ length: 100 }, (_, i) => article(151 - i));
		const resumePage2 = [article(52), article(51), article(50)];
		vi.mocked(newsRequest).mockReset();
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: [] })
			.mockResolvedValueOnce({ items: resumePage1 })
			.mockResolvedValueOnce({ items: resumePage2 });

		const result = await runNewsPoll(createPollContext({ staticData }));

		expect(newsRequest).toHaveBeenCalledTimes(3);
		expect(newsRequest).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ offset: 151 }),
			}),
		);
		expect(staticData[CATCH_UP_OFFSET_KEY]).toBeUndefined();
		expect(getMaxProcessedId(staticData)).toBeGreaterThanOrEqual(151);
		const emittedIds = (result?.[0] ?? []).map((row) => row.json.id);
		expect(emittedIds).toContain(51);
		expect(emittedIds).not.toContain(50);
	});

	it('does not drop an older catch-up gap when a second burst hits the page cap', async () => {
		const seeded = [article(50)];
		const staticData = initializedStaticData(seeded);
		const firstBurst = Array.from({ length: TRIGGER_STEADY_MAX_PAGES }, (_, page) =>
			Array.from({ length: 100 }, (_, i) =>
				article(50 + (TRIGGER_STEADY_MAX_PAGES - page + 1) * 100 - i),
			),
		);

		vi.mocked(newsRequest).mockReset();
		for (const page of firstBurst) {
			vi.mocked(newsRequest).mockResolvedValueOnce({ items: page });
		}
		await runNewsPoll(createPollContext({ staticData }));
		expect(getCatchUpOffset(staticData)).toBe(151);
		expect(getMaxProcessedId(staticData)).toBe(50);

		// Second burst of 10 full pages (newer than the first frontier).
		const secondBurst = Array.from({ length: TRIGGER_STEADY_MAX_PAGES }, (_, page) =>
			Array.from({ length: 100 }, (_, i) =>
				article(50 + (TRIGGER_STEADY_MAX_PAGES * 2 - page + 1) * 100 - i),
			),
		);
		vi.mocked(newsRequest).mockReset();
		for (const page of secondBurst) {
			vi.mocked(newsRequest).mockResolvedValueOnce({ items: page });
		}

		const mid = await runNewsPoll(createPollContext({ staticData }));
		expect(newsRequest).toHaveBeenCalledTimes(TRIGGER_STEADY_MAX_PAGES);
		// Frontier advances into the newer burst; watermark stays until W is observed.
		expect(getCatchUpOffset(staticData)).toBe(1151);
		expect(getMaxProcessedId(staticData)).toBe(50);
		const midIds = (mid?.[0] ?? []).map((row) => row.json.id);
		expect(midIds).toContain(2150);
		expect(midIds).toContain(1151);

		// Continue from 1151 through the older gap down to W (includes prior 151..51 range).
		const resumePage = Array.from({ length: 100 }, (_, i) => article(1151 - i));
		const hitWatermark = [article(1052), article(51), article(50)];
		vi.mocked(newsRequest).mockReset();
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: secondBurst[0]! })
			.mockResolvedValueOnce({ items: resumePage })
			.mockResolvedValueOnce({ items: hitWatermark });

		const finished = await runNewsPoll(createPollContext({ staticData }));
		expect(staticData[CATCH_UP_OFFSET_KEY]).toBeUndefined();
		expect(getMaxProcessedId(staticData)).toBeGreaterThanOrEqual(2150);
		const finishedIds = (finished?.[0] ?? []).map((row) => row.json.id);
		expect(finishedIds).toContain(51);
		expect(finishedIds).not.toContain(50);
	});

	it('keeps catch-up resume across soft-fail and continues afterward', async () => {
		const seeded = [article(50)];
		const staticData = initializedStaticData(seeded);
		const pages = Array.from({ length: TRIGGER_STEADY_MAX_PAGES }, (_, page) =>
			Array.from({ length: 100 }, (_, i) =>
				article(50 + (TRIGGER_STEADY_MAX_PAGES - page + 1) * 100 - i),
			),
		);

		vi.mocked(newsRequest).mockReset();
		for (const page of pages) {
			vi.mocked(newsRequest).mockResolvedValueOnce({ items: page });
		}
		await runNewsPoll(createPollContext({ staticData }));
		expect(getCatchUpOffset(staticData)).toBe(151);

		vi.mocked(newsRequest).mockReset();
		vi.mocked(newsRequest).mockRejectedValue(new Error('transient'));
		await runNewsPoll(createPollContext({ staticData }));
		expect(getCatchUpOffset(staticData)).toBe(151);
		expect(getMaxProcessedId(staticData)).toBe(50);

		const resumePage1 = Array.from({ length: 100 }, (_, i) => article(151 - i));
		const resumePage2 = [article(52), article(51), article(50)];
		vi.mocked(newsRequest).mockReset();
		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: pages[0]! })
			.mockResolvedValueOnce({ items: resumePage1 })
			.mockResolvedValueOnce({ items: resumePage2 });

		const recovered = await runNewsPoll(createPollContext({ staticData }));
		expect(staticData[CATCH_UP_OFFSET_KEY]).toBeUndefined();
		expect(getMaxProcessedId(staticData)).toBeGreaterThanOrEqual(1150);
		const recoveredIds = (recovered?.[0] ?? []).map((row) => row.json.id);
		expect(recoveredIds).toContain(51);
	});

	it('emits newly seen articles in ascending id order', async () => {
		const existing = article(100);
		const staticData = initializedStaticData([existing]);
		vi.mocked(newsRequest).mockResolvedValue({
			items: [article(103), article(101), article(102), existing],
		});

		const result = await runNewsPoll(createPollContext({ staticData }));
		const emittedIds = (result?.[0] ?? []).map((row) => row.json.id);
		expect(emittedIds).toEqual([101, 102, 103]);
	});

	it('does not re-emit articles after processed-id window eviction', async () => {
		const seeded = [article(100)];
		const staticData = initializedStaticData(seeded);
		expect(getMaxProcessedId(staticData)).toBe(100);

		// Simulate ring-buffer eviction of id 100 while watermark remains.
		staticData[PROCESSED_IDS_KEY] = Array.from({ length: 10 }, (_, i) => String(190 + i));

		vi.mocked(newsRequest).mockResolvedValue({
			items: [article(205), article(100)],
		});

		const result = await runNewsPoll(createPollContext({ staticData }));

		const emittedIds = (result?.[0] ?? []).map((row) => row.json.id);
		expect(emittedIds).toContain(205);
		expect(emittedIds).not.toContain(100);
	});

	it('re-seeds without emitting when feed scope changes', async () => {
		const feedListing = [article(200, { feedId: 67 }), article(199, { feedId: 67 })];
		const staticData = initializedStaticData([article(101)]);

		vi.mocked(newsRequest)
			.mockResolvedValueOnce({ items: feedListing })
			.mockResolvedValueOnce({ items: feedListing });

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
		expect(getMaxProcessedId(staticData)).toBe(200);
		expect(newsRequest).toHaveBeenCalledTimes(2);
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

	it('passes folder scope when the locator is a bare numeric expression result', async () => {
		vi.mocked(newsRequest).mockResolvedValue({ items: [] });

		await runNewsPoll(
			createPollContext({ staticData: {}, folderId: 12, bareLocatorValues: true }),
		);

		expect(newsRequest).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/items',
			expect.objectContaining({
				qs: expect.objectContaining({ type: 1, id: 12, getRead: false }),
			}),
		);
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
