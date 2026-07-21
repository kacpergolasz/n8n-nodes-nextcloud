import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	IPollFunctions,
} from 'n8n-workflow';

import {
	getCredentials,
	newsRequest,
	unwrapItems,
} from '../NextcloudNews/GenericFunctions';
import type { NewsItem } from '../NextcloudNews/NewsInterface';
import { itemToJson } from '../NextcloudNews/resources/shared/entityJson';
import { parseLocatorParamValue } from '../NextcloudNews/resources/shared/resolveInput';
import { scrubErrorMessage } from '../NextcloudNews/shared/scrubSecrets';
import { parseRequiredBoolean, type NextcloudCredentialData } from '../shared/parse';
import {
	buildNewsItemsQueryParams,
	nextNewsOffsetFromItems,
	type NewsItemsQueryType,
} from '../shared/pagination';
import {
	DEFAULT_MAX_PROCESSED_IDS,
	LAST_TIME_CHECKED_KEY,
	PROCESSED_IDS_KEY,
	filterIdsInStaticData,
	getLastTimeChecked,
	getProcessedIds,
} from '../shared/pollHelpers';
import {
	clearSoftFailNotice,
	handlePollListingFailure,
	pollErrorNoticeItem,
	returnManualSampleOrNull,
	runPollBootstrap,
	setPollErrorNoticeShown,
} from '../shared/pollOrchestration';

export {
	POLL_ERROR_NOTICE_SHOWN_KEY,
	isPollErrorNoticeShown,
	pollErrorNoticeItem,
	setPollErrorNoticeShown,
} from '../shared/pollOrchestration';

/** Default page size for trigger item fetches (News `batchSize`). */
export const DEFAULT_TRIGGER_PAGE_SIZE = 100;

/**
 * Default steady-state catch-up page budget per poll. Lower than the historical
 * hardcoded 10 to reduce worst-case API load; unfinished work resumes next poll.
 */
export const DEFAULT_TRIGGER_MAX_PAGES_PER_POLL = 5;

/** @deprecated Prefer {@link DEFAULT_TRIGGER_PAGE_SIZE}. */
export const TRIGGER_ITEMS_BATCH_SIZE = DEFAULT_TRIGGER_PAGE_SIZE;

/**
 * Seed/re-seed only: max pages when walking `offset` so huge inboxes cannot
 * hang activation. Aligns with the processed-id window ceiling at default page size.
 */
export const TRIGGER_SEED_MAX_PAGES = Math.ceil(
	DEFAULT_MAX_PROCESSED_IDS / DEFAULT_TRIGGER_PAGE_SIZE,
);

/** @deprecated Prefer {@link DEFAULT_TRIGGER_MAX_PAGES_PER_POLL}. */
export const TRIGGER_STEADY_MAX_PAGES = DEFAULT_TRIGGER_MAX_PAGES_PER_POLL;

export type NewsPollLimits = {
	pageSize: number;
	maxPagesPerPoll: number;
};

export function seedMaxPagesForPageSize(pageSize: number): number {
	const size = pageSize >= 1 ? Math.trunc(pageSize) : DEFAULT_TRIGGER_PAGE_SIZE;
	return Math.ceil(DEFAULT_MAX_PROCESSED_IDS / size);
}

function readPositiveIntParam(
	context: IPollFunctions,
	paramName: string,
	fallback: number,
): number {
	const raw: unknown = context.getNodeParameter(paramName);
	const coerced =
		typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
	if (!Number.isFinite(coerced) || coerced < 1) {
		return fallback;
	}
	return Math.trunc(coerced);
}

/** Read configured poll bounds from node parameters (safe defaults on bad values). */
export function resolveNewsPollLimits(context: IPollFunctions): NewsPollLimits {
	return {
		pageSize: readPositiveIntParam(context, 'pageSize', DEFAULT_TRIGGER_PAGE_SIZE),
		maxPagesPerPoll: readPositiveIntParam(
			context,
			'maxPagesPerPoll',
			DEFAULT_TRIGGER_MAX_PAGES_PER_POLL,
		),
	};
}

/** Scope key the current ID window was seeded for (folder/feed/unread). */
export const POLL_SCOPE_KEY = 'pollScope';

/**
 * High-water mark of article ids already accounted for. News ids are monotonic,
 * so anything ≤ this value is treated as seen (avoids re-fire when the
 * processed-id ring buffer evicts older entries).
 */
export const MAX_PROCESSED_ID_KEY = 'maxProcessedId';

/**
 * When a per-poll catch-up hits the configured page budget before reaching
 * the watermark, resume from this offset on the next poll so mid-burst articles
 * are not permanently skipped. Cleared only after catch-up observes an id ≤ W
 * (or the list is exhausted). Survives soft-fail.
 */
export const CATCH_UP_OFFSET_KEY = 'catchUpOffset';

/**
 * @deprecated Stop target is always {@link MAX_PROCESSED_ID_KEY}; kept only so
 * older static data is cleared cleanly.
 */
export const CATCH_UP_UNTIL_ID_KEY = 'catchUpUntilId';

export type NewsPollScope = {
	folderId?: number;
	feedId?: number;
	unreadOnly: boolean;
};

export type NewsPollScopeResolved = {
	type: NewsItemsQueryType;
	id: number;
	getRead: boolean;
	scopeKey: string;
};

function asLoadOptionsContext(context: IPollFunctions): ILoadOptionsFunctions {
	return context as unknown as ILoadOptionsFunctions;
}

/**
 * Map optional folder/feed filters to News `GET /items` type/id.
 * Precedence: feed → folder → all feeds.
 */
export function resolveNewsPollScope(scope: NewsPollScope): NewsPollScopeResolved {
	let type: NewsItemsQueryType = 3;
	let id = 0;

	if (scope.feedId !== undefined) {
		type = 0;
		id = scope.feedId;
	} else if (scope.folderId !== undefined) {
		type = 1;
		id = scope.folderId;
	}

	const getRead = !scope.unreadOnly;
	const scopeKey = `folder:${scope.folderId ?? ''}|feed:${scope.feedId ?? ''}|unread:${scope.unreadOnly}`;

	return { type, id, getRead, scopeKey };
}

export function resolveOptionalLocatorId(
	context: IPollFunctions,
	paramName: string,
	resourceLabel: string,
): number | undefined {
	const raw: unknown = context.getNodeParameter(paramName);
	const valueStr = parseLocatorParamValue(raw);

	if (valueStr === undefined) {
		return undefined;
	}

	const id = Number(valueStr);
	if (!Number.isFinite(id)) {
		throw new Error(`${resourceLabel} id is invalid: ${valueStr}`);
	}

	return Math.trunc(id);
}

export function readPollScopeFromNode(context: IPollFunctions): NewsPollScope {
	return {
		folderId: resolveOptionalLocatorId(context, 'folder', 'Folder'),
		feedId: resolveOptionalLocatorId(context, 'feed', 'Feed'),
		unreadOnly: parseRequiredBoolean(context.getNodeParameter('unreadOnly'), 'Unread Only'),
	};
}

export function getPollScope(staticData: IDataObject): string | undefined {
	const value = staticData[POLL_SCOPE_KEY];
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	return String(value);
}

export function getMaxProcessedId(staticData: IDataObject): number {
	const value = staticData[MAX_PROCESSED_ID_KEY];
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return 0;
}

export function setMaxProcessedId(staticData: IDataObject, maxId: number): void {
	staticData[MAX_PROCESSED_ID_KEY] = maxId;
}

export function getCatchUpOffset(staticData: IDataObject): number | undefined {
	const value = staticData[CATCH_UP_OFFSET_KEY];
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return undefined;
}

export function getCatchUpUntilId(staticData: IDataObject): number | undefined {
	const value = staticData[CATCH_UP_UNTIL_ID_KEY];
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

export function clearCatchUpState(staticData: IDataObject): void {
	delete staticData[CATCH_UP_OFFSET_KEY];
	delete staticData[CATCH_UP_UNTIL_ID_KEY];
}

export function setCatchUpOffset(staticData: IDataObject, offset: number): void {
	staticData[CATCH_UP_OFFSET_KEY] = offset;
	// Drop legacy until-id; watermark is the sole stop target.
	delete staticData[CATCH_UP_UNTIL_ID_KEY];
}

function maxArticleId(items: NewsItem[]): number {
	let maxId = 0;
	for (const item of items) {
		if (item.id > maxId) {
			maxId = item.id;
		}
	}
	return maxId;
}

/**
 * Initialized only when cursor, processed-id window, and scope all match the
 * current poll filters. Missing any piece (or a scope change) triggers re-seed.
 */
export function isNewsPollInitialized(staticData: IDataObject, scopeKey: string): boolean {
	return (
		getLastTimeChecked(staticData) !== undefined &&
		Array.isArray(staticData[PROCESSED_IDS_KEY]) &&
		staticData[MAX_PROCESSED_ID_KEY] !== undefined &&
		staticData[MAX_PROCESSED_ID_KEY] !== null &&
		getPollScope(staticData) === scopeKey
	);
}

export function seedNewsPollState(
	staticData: IDataObject,
	scopeKey: string,
	items: NewsItem[],
	now: number = Date.now(),
	/**
	 * Explicit high-water mark (e.g. max id from an all-items newest page when
	 * seeding under unread-only). Defaults to max id among `items`.
	 */
	maxProcessedId?: number,
): void {
	// Reset the window first so a scope change does not retain prior-scope ids.
	staticData[PROCESSED_IDS_KEY] = [];
	clearCatchUpState(staticData);
	const candidateIds = items.map((item) => String(item.id));
	// Advance the ID window without emitting — marks current articles as seen.
	filterIdsInStaticData(candidateIds, staticData);
	const itemsMax = maxArticleId(items);
	setMaxProcessedId(
		staticData,
		maxProcessedId !== undefined ? Math.max(itemsMax, maxProcessedId) : itemsMax,
	);
	staticData[LAST_TIME_CHECKED_KEY] = new Date(now).toISOString();
	staticData[POLL_SCOPE_KEY] = scopeKey;
	setPollErrorNoticeShown(staticData, false);
}

export function articleToOutputItem(item: NewsItem): IDataObject {
	return itemToJson(item);
}

/**
 * Advance the News item-id cursor for the next page, or `undefined` when
 * paging should stop (partial page / missing cursor / non-advancing cursor).
 *
 * Stop when there is no next cursor — not by comparing against the prior
 * query offset (that falsely aborts after page 1 when `previousOffset` was 0).
 */
export function nextTriggerPageOffset(
	items: NewsItem[],
	offset: number,
	pageSize: number = DEFAULT_TRIGGER_PAGE_SIZE,
): number | undefined {
	if (items.length < pageSize) {
		return undefined;
	}

	const nextOffset = nextNewsOffsetFromItems(items);
	if (nextOffset === undefined) {
		return undefined;
	}

	// Inclusive cursors can repeat the boundary id; stop if we would not move older.
	if (offset !== 0 && nextOffset >= offset) {
		return undefined;
	}

	return nextOffset;
}

export async function loadTriggerItemsPage(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	offset: number = 0,
	pageSize: number = DEFAULT_TRIGGER_PAGE_SIZE,
): Promise<NewsItem[]> {
	const qs = buildNewsItemsQueryParams({
		batchSize: pageSize,
		offset,
		type: scope.type,
		id: scope.id,
		getRead: scope.getRead,
		oldestFirst: false,
	});

	return unwrapItems(await newsRequest(context, 'GET', '/items', { qs }));
}

/** Append page items, skipping ids already in `seenIds` (inclusive-offset overlap). */
export function appendUniqueNewsItems(
	collected: NewsItem[],
	page: NewsItem[],
	seenIds: Set<string>,
): void {
	for (const item of page) {
		const id = String(item.id);
		if (seenIds.has(id)) {
			continue;
		}
		seenIds.add(id);
		collected.push(item);
	}
}

/** Single newest page (offset 0) — used by manual mode. */
export async function loadTriggerItems(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	pageSize: number = DEFAULT_TRIGGER_PAGE_SIZE,
): Promise<NewsItem[]> {
	return loadTriggerItemsPage(context, scope, 0, pageSize);
}

/**
 * Newest-page max article id for the folder/feed scope with `getRead: true`.
 * Used on unread-only seed so the watermark covers pre-existing read articles
 * (avoids false-fire when those are later marked unread).
 */
export async function loadScopeMaxArticleId(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	pageSize: number = DEFAULT_TRIGGER_PAGE_SIZE,
): Promise<number> {
	const newestAll = await loadTriggerItemsPage(
		context,
		{ ...scope, getRead: true },
		0,
		pageSize,
	);
	return maxArticleId(newestAll);
}

/**
 * Seed/re-seed: walk News `offset` pages until a partial/empty page so the ID
 * window covers the current backlog (not only the newest page).
 */
export async function loadAllTriggerItemsForSeed(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	pageSize: number = DEFAULT_TRIGGER_PAGE_SIZE,
): Promise<NewsItem[]> {
	const collected: NewsItem[] = [];
	const seenIds = new Set<string>();
	let offset = 0;
	const maxPages = seedMaxPagesForPageSize(pageSize);

	for (let page = 0; page < maxPages; page++) {
		const items = await loadTriggerItemsPage(context, scope, offset, pageSize);
		if (items.length === 0) {
			break;
		}

		appendUniqueNewsItems(collected, items, seenIds);

		if (collected.length >= DEFAULT_MAX_PROCESSED_IDS) {
			return collected.slice(0, DEFAULT_MAX_PROCESSED_IDS);
		}

		const nextOffset = nextTriggerPageOffset(items, offset, pageSize);
		if (nextOffset === undefined) {
			break;
		}

		offset = nextOffset;
	}

	return collected;
}

/**
 * Steady-state: walk newest → older toward the watermark with a per-poll page
 * budget. Completeness is driven only by {@link MAX_PROCESSED_ID_KEY}; the ring
 * buffer never ends catch-up. When the budget runs out before id ≤ W, persist
 * {@link CATCH_UP_OFFSET_KEY} and continue next poll (resume survives soft-fail).
 *
 * With a pending resume R: peek from offset 0 for a newer burst, then continue
 * from R toward W so already-fetched pages are not re-walked within the budget.
 */
export async function loadTriggerItemsWithCatchUp(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	staticData: IDataObject,
	limits: NewsPollLimits = {
		pageSize: DEFAULT_TRIGGER_PAGE_SIZE,
		maxPagesPerPoll: DEFAULT_TRIGGER_MAX_PAGES_PER_POLL,
	},
): Promise<NewsItem[]> {
	const watermark = getMaxProcessedId(staticData);
	const priorOffset = getCatchUpOffset(staticData);
	const processedIds = new Set(getProcessedIds(staticData));

	const collected: NewsItem[] = [];
	const seenIds = new Set<string>();
	let pagesLeft = limits.maxPagesPerPoll;

	const newest = await collectCatchUpPages(context, scope, collected, seenIds, {
		startOffset: 0,
		stopAtOrBelowId: watermark,
		resumeFrontier: priorOffset,
		processedIds,
		maxPages: pagesLeft,
		pageSize: limits.pageSize,
	});
	pagesLeft -= newest.pagesUsed;

	if (newest.status === 'incomplete') {
		// New burst from the top deeper than the budget; frontier moves older.
		setCatchUpOffset(staticData, newest.nextOffset);
		return collected;
	}

	if (newest.reason === 'watermark') {
		clearCatchUpState(staticData);
		return collected;
	}

	// Peek exhausted with no pending resume means the listing is done from the top.
	if (newest.reason === 'exhausted' && priorOffset === undefined) {
		clearCatchUpState(staticData);
		return collected;
	}

	// Reached resume frontier / known territory from the top, or peek exhausted
	// while a resume cursor exists — continue toward W from the saved offset.
	if (priorOffset !== undefined && pagesLeft > 0) {
		const resumed = await collectCatchUpPages(context, scope, collected, seenIds, {
			startOffset: priorOffset,
			stopAtOrBelowId: watermark,
			processedIds,
			maxPages: pagesLeft,
			pageSize: limits.pageSize,
		});
		if (resumed.status === 'incomplete') {
			setCatchUpOffset(staticData, resumed.nextOffset);
			return collected;
		}
		clearCatchUpState(staticData);
		return collected;
	}

	return collected;
}

type CatchUpPageResult =
	| {
			status: 'complete';
			reason: 'watermark' | 'frontier' | 'exhausted';
			pagesUsed: number;
	  }
	| { status: 'incomplete'; nextOffset: number; pagesUsed: number };

async function collectCatchUpPages(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	collected: NewsItem[],
	seenIds: Set<string>,
	options: {
		startOffset: number;
		stopAtOrBelowId: number;
		/** When set, reaching this offset (or a fully-known page) ends the phase so resume can continue. */
		resumeFrontier?: number;
		processedIds: Set<string>;
		maxPages: number;
		pageSize: number;
	},
): Promise<CatchUpPageResult> {
	const { stopAtOrBelowId, resumeFrontier, processedIds, maxPages, pageSize } = options;
	let offset = options.startOffset;

	if (maxPages <= 0) {
		return { status: 'incomplete', nextOffset: offset, pagesUsed: 0 };
	}

	for (let page = 0; page < maxPages; page++) {
		const items = await loadTriggerItemsPage(context, scope, offset, pageSize);
		const pagesUsed = page + 1;

		if (items.length === 0) {
			return { status: 'complete', reason: 'exhausted', pagesUsed };
		}

		appendUniqueNewsItems(collected, items, seenIds);

		if (items.some((item) => item.id <= stopAtOrBelowId)) {
			return { status: 'complete', reason: 'watermark', pagesUsed };
		}

		if (resumeFrontier !== undefined) {
			const reachedFrontier = items.some((item) => item.id <= resumeFrontier);
			const knownTerritory = items.every((item) =>
				processedIds.has(String(item.id)),
			);
			if (reachedFrontier || knownTerritory) {
				return { status: 'complete', reason: 'frontier', pagesUsed };
			}
		}

		const nextOffset = nextTriggerPageOffset(items, offset, pageSize);
		if (nextOffset === undefined) {
			return { status: 'complete', reason: 'exhausted', pagesUsed };
		}

		if (page === maxPages - 1) {
			return { status: 'incomplete', nextOffset, pagesUsed };
		}

		offset = nextOffset;
	}

	return { status: 'complete', reason: 'exhausted', pagesUsed: maxPages };
}

export async function runNewsPoll(
	context: IPollFunctions,
): Promise<INodeExecutionData[][] | null> {
	const staticData = context.getWorkflowStaticData('node');
	const isManual = context.getMode() === 'manual';
	const requestContext = asLoadOptionsContext(context);

	const { credentials, resolved, limits } = await runPollBootstrap(
		context,
		async () => {
			const credentials = await getCredentials(requestContext);
			const pollScope = readPollScopeFromNode(context);
			const resolved = resolveNewsPollScope(pollScope);
			const limits = resolveNewsPollLimits(context);
			return { credentials, resolved, limits };
		},
		async (error) => {
			let secrets: NextcloudCredentialData | Record<string, never> = {};
			try {
				secrets = await getCredentials(requestContext);
			} catch {
				// ignore credential load failures while scrubbing
			}
			return scrubErrorMessage(error, secrets);
		},
	);

	const isInitialized = isNewsPollInitialized(staticData, resolved.scopeKey);

	let items: NewsItem[];
	/** All-items newest-page max; set during unread-only seed only. */
	let seedScopeMaxId: number | undefined;
	try {
		if (!isManual && !isInitialized) {
			items = await loadAllTriggerItemsForSeed(requestContext, resolved, limits.pageSize);
			// Unread listings omit read articles; raise W from newest all-items page.
			if (!resolved.getRead) {
				seedScopeMaxId = await loadScopeMaxArticleId(
					requestContext,
					resolved,
					limits.pageSize,
				);
			}
		} else if (!isManual && isInitialized) {
			items = await loadTriggerItemsWithCatchUp(
				requestContext,
				resolved,
				staticData,
				limits,
			);
		} else {
			items = await loadTriggerItemsPage(requestContext, resolved, 0, limits.pageSize);
		}
	} catch (error) {
		return handlePollListingFailure(context, {
			isInitialized,
			error,
			scrubError: (err) => scrubErrorMessage(err, credentials),
			logLabel: 'Nextcloud News Trigger',
			softFail: {
				mode: 'oneShotNotice',
				staticData,
				buildNoticeItem: pollErrorNoticeItem,
			},
		});
	}

	// Successful listing clears the soft-fail notice window.
	clearSoftFailNotice(staticData);

	if (isManual) {
		return returnManualSampleOrNull(
			context,
			items[0] ? articleToOutputItem(items[0]) : undefined,
			'Nextcloud News Trigger: manual sample unavailable (no matching articles). Returning null.',
		);
	}

	if (!isInitialized) {
		seedNewsPollState(staticData, resolved.scopeKey, items, Date.now(), seedScopeMaxId);
		return null;
	}

	const watermark = getMaxProcessedId(staticData);
	const candidateIds = items.map((item) => String(item.id));
	// Record every fetched id in the ring buffer (in-poll / window dedupe only).
	const { unseenIds } = filterIdsInStaticData(candidateIds, staticData);
	staticData[LAST_TIME_CHECKED_KEY] = new Date().toISOString();

	// Raise W only after catch-up fully reached the prior watermark (no resume left).
	if (getCatchUpOffset(staticData) === undefined) {
		const fetchedMax = maxArticleId(items);
		if (fetchedMax > watermark) {
			setMaxProcessedId(staticData, fetchedMax);
		}
	}

	// Emit only ids above the pre-poll watermark; ascending id order for workflows.
	const remainingUnseen = new Set(
		unseenIds.filter((id) => Number(id) > watermark),
	);
	const newArticles: NewsItem[] = [];
	for (const item of items) {
		const id = String(item.id);
		if (!remainingUnseen.has(id)) {
			continue;
		}
		remainingUnseen.delete(id);
		newArticles.push(item);
	}

	if (newArticles.length === 0) {
		return null;
	}

	newArticles.sort((a, b) => a.id - b.id);

	return [context.helpers.returnJsonArray(newArticles.map(articleToOutputItem))];
}

/** Exported for tests that need to inspect the processed-id window. */
export function getProcessedArticleIds(staticData: IDataObject): string[] {
	return getProcessedIds(staticData);
}
