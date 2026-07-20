import {
	DEFAULT_MAX_PROCESSED_IDS,
	LAST_TIME_CHECKED_KEY,
	PROCESSED_IDS_KEY,
	filterIdsByWindow,
	filterIdsInStaticData,
	getLastTimeChecked,
	getProcessedIds,
	seedLastTimeChecked,
	type PollStaticData,
} from '../pollHelpers';

describe('pollHelpers', () => {
	describe('seedLastTimeChecked / getLastTimeChecked', () => {
		it('seeds lastTimeChecked when static data is empty', () => {
			const staticData: PollStaticData = {};
			const now = '2026-07-20T06:00:00.000Z';

			expect(seedLastTimeChecked(staticData, now)).toBe(now);
			expect(staticData[LAST_TIME_CHECKED_KEY]).toBe(now);
			expect(getLastTimeChecked(staticData)).toBe(now);
		});

		it('accepts numeric timestamps when seeding', () => {
			const staticData: PollStaticData = {};
			const nowMs = Date.parse('2026-07-20T06:00:00.000Z');

			expect(seedLastTimeChecked(staticData, nowMs)).toBe('2026-07-20T06:00:00.000Z');
		});

		it('preserves an existing cursor', () => {
			const staticData: PollStaticData = {
				[LAST_TIME_CHECKED_KEY]: '2026-07-19T12:00:00.000Z',
			};

			expect(seedLastTimeChecked(staticData, '2026-07-20T06:00:00.000Z')).toBe(
				'2026-07-19T12:00:00.000Z',
			);
			expect(staticData[LAST_TIME_CHECKED_KEY]).toBe('2026-07-19T12:00:00.000Z');
		});
	});

	describe('filterIdsByWindow / filterIdsInStaticData', () => {
		it('returns only unseen ids and tracks processed ids', () => {
			const result = filterIdsByWindow(['a', 'b', 'a', 'c'], ['b']);

			expect(result.unseenIds).toEqual(['a', 'c']);
			expect(result.processedIds).toEqual(['b', 'a', 'c']);
		});

		it('caps the processed id window and drops oldest entries', () => {
			const result = filterIdsByWindow(['f', 'g'], ['a', 'b', 'c', 'd', 'e'], 5);

			expect(result.unseenIds).toEqual(['f', 'g']);
			expect(result.processedIds).toEqual(['c', 'd', 'e', 'f', 'g']);
		});

		it('uses the default cap size', () => {
			const processedIds = Array.from({ length: DEFAULT_MAX_PROCESSED_IDS }, (_, i) =>
				String(i),
			);
			const result = filterIdsByWindow(['new-id'], processedIds);

			expect(result.unseenIds).toEqual(['new-id']);
			expect(result.processedIds).toHaveLength(DEFAULT_MAX_PROCESSED_IDS);
			expect(result.processedIds.at(-1)).toBe('new-id');
			expect(result.processedIds[0]).toBe('1');
		});

		it('persists filtered ids in static data via filterIdsInStaticData', () => {
			const staticData: PollStaticData = {
				[PROCESSED_IDS_KEY]: ['seen'],
			};

			const result = filterIdsInStaticData(['seen', 'fresh'], staticData, { maxSize: 3 });

			expect(result.unseenIds).toEqual(['fresh']);
			expect(getProcessedIds(staticData)).toEqual(['seen', 'fresh']);
		});
	});
});
