import type { IDataObject } from 'n8n-workflow';

export const LAST_TIME_CHECKED_KEY = 'lastTimeChecked';
export const PROCESSED_IDS_KEY = 'processedIds';
export const DEFAULT_MAX_PROCESSED_IDS = 10_000;

/** Workflow static data slice used by suite polling triggers. */
export type PollStaticData = IDataObject;

export function getLastTimeChecked(staticData: PollStaticData): string | undefined {
	const value = staticData[LAST_TIME_CHECKED_KEY];
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	return String(value);
}

/**
 * Seed `lastTimeChecked` when absent. Returns the stored cursor without overwriting
 * an existing value (activation re-polls must not rewind the cursor).
 */
export function seedLastTimeChecked(staticData: PollStaticData, now: string | number): string {
	const existing = getLastTimeChecked(staticData);
	if (existing !== undefined) {
		return existing;
	}

	const seeded = typeof now === 'number' ? new Date(now).toISOString() : now;
	staticData[LAST_TIME_CHECKED_KEY] = seeded;
	return seeded;
}

export function getProcessedIds(
	staticData: PollStaticData,
	key: string = PROCESSED_IDS_KEY,
): string[] {
	const raw = staticData[key];
	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.filter((id): id is string => typeof id === 'string');
}

export type IdWindowFilterResult = {
	unseenIds: string[];
	processedIds: string[];
};

/**
 * Salesforce-inspired bounded ID window: return unseen ids, append them to the
 * processed list, and trim oldest entries when over `maxSize`.
 */
export function filterIdsByWindow(
	candidateIds: string[],
	processedIds: string[],
	maxSize: number = DEFAULT_MAX_PROCESSED_IDS,
): IdWindowFilterResult {
	const seen = new Set(processedIds);
	const unseenIds: string[] = [];
	const newlyProcessed: string[] = [];

	for (const id of candidateIds) {
		if (seen.has(id)) {
			continue;
		}

		unseenIds.push(id);
		newlyProcessed.push(id);
		seen.add(id);
	}

	if (newlyProcessed.length === 0) {
		return { unseenIds, processedIds };
	}

	return {
		unseenIds,
		processedIds: [...processedIds, ...newlyProcessed].slice(-maxSize),
	};
}

/** Read processed ids from static data, filter candidates, and persist the window. */
export function filterIdsInStaticData(
	candidateIds: string[],
	staticData: PollStaticData,
	options?: { maxSize?: number; key?: string },
): IdWindowFilterResult {
	const key = options?.key ?? PROCESSED_IDS_KEY;
	const processedIds = getProcessedIds(staticData, key);
	const result = filterIdsByWindow(candidateIds, processedIds, options?.maxSize);
	staticData[key] = result.processedIds;
	return result;
}
