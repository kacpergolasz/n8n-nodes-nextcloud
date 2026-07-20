import {
	DEFAULT_CLIENT_LIMIT,
	DEFAULT_NEWS_BATCH_SIZE,
	DEFAULT_NEWS_OFFSET,
	NEWS_BATCH_SIZE_ALL,
	applyReturnAllLimit,
	buildNewsItemsQueryParams,
	nextNewsOffsetFromItems,
	normalizeNewsBatchSize,
	normalizeNewsOffset,
} from '../pagination';

describe('pagination', () => {
	describe('applyReturnAllLimit (client-limit mode)', () => {
		const items = ['a', 'b', 'c', 'd', 'e'];

		it('returns the full list when returnAll is true', () => {
			expect(applyReturnAllLimit(items, true, 2)).toEqual(items);
		});

		it('slices to limit when returnAll is false', () => {
			expect(applyReturnAllLimit(items, false, 2)).toEqual(['a', 'b']);
		});

		it('uses DEFAULT_CLIENT_LIMIT when limit is omitted', () => {
			const many = Array.from({ length: DEFAULT_CLIENT_LIMIT + 10 }, (_, i) => i);
			expect(applyReturnAllLimit(many, false)).toHaveLength(DEFAULT_CLIENT_LIMIT);
		});

		it('falls back to DEFAULT_CLIENT_LIMIT for non-positive or non-finite limit', () => {
			const many = Array.from({ length: DEFAULT_CLIENT_LIMIT + 5 }, (_, i) => i);
			expect(applyReturnAllLimit(many, false, 0)).toHaveLength(DEFAULT_CLIENT_LIMIT);
			expect(applyReturnAllLimit(many, false, -3)).toHaveLength(DEFAULT_CLIENT_LIMIT);
			expect(applyReturnAllLimit(many, false, Number.NaN)).toHaveLength(DEFAULT_CLIENT_LIMIT);
		});

		it('floors fractional limits', () => {
			expect(applyReturnAllLimit(items, false, 2.9)).toEqual(['a', 'b']);
		});

		it('returns empty when input is empty', () => {
			expect(applyReturnAllLimit([], false, 10)).toEqual([]);
			expect(applyReturnAllLimit([], true)).toEqual([]);
		});
	});

	describe('normalizeNewsBatchSize / normalizeNewsOffset', () => {
		it('defaults batchSize to -1 (all)', () => {
			expect(normalizeNewsBatchSize()).toBe(DEFAULT_NEWS_BATCH_SIZE);
			expect(normalizeNewsBatchSize(undefined)).toBe(NEWS_BATCH_SIZE_ALL);
		});

		it('preserves batchSize=-1', () => {
			expect(normalizeNewsBatchSize(-1)).toBe(NEWS_BATCH_SIZE_ALL);
		});

		it('keeps positive batchSize values', () => {
			expect(normalizeNewsBatchSize(10)).toBe(10);
			expect(normalizeNewsBatchSize(20.7)).toBe(20);
		});

		it('rejects non-positive batchSize other than -1', () => {
			expect(normalizeNewsBatchSize(0)).toBe(DEFAULT_CLIENT_LIMIT);
			expect(normalizeNewsBatchSize(-5)).toBe(DEFAULT_CLIENT_LIMIT);
			expect(normalizeNewsBatchSize(Number.NaN)).toBe(DEFAULT_CLIENT_LIMIT);
		});

		it('defaults offset to 0', () => {
			expect(normalizeNewsOffset()).toBe(DEFAULT_NEWS_OFFSET);
			expect(normalizeNewsOffset(undefined)).toBe(0);
		});

		it('keeps non-negative offsets and rejects negatives / NaN', () => {
			expect(normalizeNewsOffset(43)).toBe(43);
			expect(normalizeNewsOffset(12.9)).toBe(12);
			expect(normalizeNewsOffset(-1)).toBe(DEFAULT_NEWS_OFFSET);
			expect(normalizeNewsOffset(Number.NaN)).toBe(DEFAULT_NEWS_OFFSET);
		});
	});

	describe('buildNewsItemsQueryParams (News cursor mode)', () => {
		it('always includes normalized batchSize and offset', () => {
			expect(buildNewsItemsQueryParams()).toEqual({
				batchSize: NEWS_BATCH_SIZE_ALL,
				offset: 0,
			});
		});

		it('builds a paged query with filters', () => {
			expect(
				buildNewsItemsQueryParams({
					batchSize: 20,
					offset: 43,
					type: 0,
					id: 12,
					getRead: false,
					oldestFirst: true,
				}),
			).toEqual({
				batchSize: 20,
				offset: 43,
				type: 0,
				id: 12,
				getRead: false,
				oldestFirst: true,
			});
		});

		it('omits optional filters when not provided', () => {
			expect(buildNewsItemsQueryParams({ batchSize: 10, offset: 0 })).toEqual({
				batchSize: 10,
				offset: 0,
			});
		});

		it('normalizes invalid batchSize / offset in the query', () => {
			expect(buildNewsItemsQueryParams({ batchSize: 0, offset: -9 })).toEqual({
				batchSize: DEFAULT_CLIENT_LIMIT,
				offset: 0,
			});
		});
	});

	describe('nextNewsOffsetFromItems', () => {
		it('returns the lowest item id as the next offset cursor', () => {
			expect(
				nextNewsOffsetFromItems([{ id: 50 }, { id: 43 }, { id: 60 }]),
			).toBe(43);
		});

		it('returns undefined for an empty page', () => {
			expect(nextNewsOffsetFromItems([])).toBeUndefined();
		});

		it('handles a single-item page', () => {
			expect(nextNewsOffsetFromItems([{ id: 7 }])).toBe(7);
		});

		it('documents News autopaging: next page uses lowest id as offset', () => {
			// Mirror https://nextcloud.github.io/news/api/api-v1-3/ Get items example.
			const firstPage = [
				{ id: 62 },
				{ id: 55 },
				{ id: 43 },
			];
			const nextOffset = nextNewsOffsetFromItems(firstPage);
			expect(nextOffset).toBe(43);

			expect(
				buildNewsItemsQueryParams({
					batchSize: 20,
					offset: nextOffset,
					type: 1,
					id: 12,
					getRead: false,
				}),
			).toEqual({
				batchSize: 20,
				offset: 43,
				type: 1,
				id: 12,
				getRead: false,
			});
		});
	});
});
