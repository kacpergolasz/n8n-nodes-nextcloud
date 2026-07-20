import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	getCredentials,
	newsRequest,
	unwrapItems,
} from '../NextcloudNews/GenericFunctions';
import type { NewsItem, NextcloudCredentialData } from '../NextcloudNews/NewsInterface';
import { itemToJson } from '../NextcloudNews/resources/shared/entityJson';
import { scrubErrorMessage } from '../NextcloudNews/shared/scrubSecrets';
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

/** Bounded page of newest candidates per poll (avoids unbounded history pulls). */
export const TRIGGER_ITEMS_BATCH_SIZE = 100;

/**
 * Seed/re-seed only: max pages when walking `offset` so huge inboxes cannot
 * hang activation. Aligns with the processed-id window ceiling.
 */
export const TRIGGER_SEED_MAX_PAGES = Math.ceil(
	DEFAULT_MAX_PROCESSED_IDS / TRIGGER_ITEMS_BATCH_SIZE,
);

/**
 * Steady-state catch-up: max pages per poll when a burst of new articles fills
 * the newest page (avoids permanently missing older new ids).
 */
export const TRIGGER_STEADY_MAX_PAGES = 10;

/** Scope key the current ID window was seeded for (folder/feed/unread). */
export const POLL_SCOPE_KEY = 'pollScope';

/** True after a soft-fail notice item was emitted for the current failure window. */
export const POLL_ERROR_NOTICE_SHOWN_KEY = 'pollErrorNoticeShown';

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

function throwPollError(context: IPollFunctions, message: string): never {
	throw new NodeApiError(context.getNode(), { message } as JsonObject);
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
	const locator = context.getNodeParameter(paramName) as INodeParameterResourceLocator;
	const value = locator?.value;
	if (value === undefined || value === null || String(value).trim() === '') {
		return undefined;
	}

	const id = Number(String(value).trim());
	if (!Number.isFinite(id)) {
		throw new Error(`${resourceLabel} id is invalid: ${value}`);
	}

	return Math.trunc(id);
}

export function readPollScopeFromNode(context: IPollFunctions): NewsPollScope {
	return {
		folderId: resolveOptionalLocatorId(context, 'folder', 'Folder'),
		feedId: resolveOptionalLocatorId(context, 'feed', 'Feed'),
		unreadOnly: context.getNodeParameter('unreadOnly') as boolean,
	};
}

export function getPollScope(staticData: IDataObject): string | undefined {
	const value = staticData[POLL_SCOPE_KEY];
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	return String(value);
}

export function isPollErrorNoticeShown(staticData: IDataObject): boolean {
	return staticData[POLL_ERROR_NOTICE_SHOWN_KEY] === true;
}

export function setPollErrorNoticeShown(staticData: IDataObject, shown: boolean): void {
	if (shown) {
		staticData[POLL_ERROR_NOTICE_SHOWN_KEY] = true;
	} else {
		delete staticData[POLL_ERROR_NOTICE_SHOWN_KEY];
	}
}

/**
 * Initialized only when cursor, processed-id window, and scope all match the
 * current poll filters. Missing any piece (or a scope change) triggers re-seed.
 */
export function isNewsPollInitialized(staticData: IDataObject, scopeKey: string): boolean {
	return (
		getLastTimeChecked(staticData) !== undefined &&
		Array.isArray(staticData[PROCESSED_IDS_KEY]) &&
		getPollScope(staticData) === scopeKey
	);
}

export function seedNewsPollState(
	staticData: IDataObject,
	scopeKey: string,
	items: NewsItem[],
	now: number = Date.now(),
): void {
	// Reset the window first so a scope change does not retain prior-scope ids.
	staticData[PROCESSED_IDS_KEY] = [];
	const candidateIds = items.map((item) => String(item.id));
	// Advance the ID window without emitting — marks current articles as seen.
	filterIdsInStaticData(candidateIds, staticData);
	staticData[LAST_TIME_CHECKED_KEY] = new Date(now).toISOString();
	staticData[POLL_SCOPE_KEY] = scopeKey;
	setPollErrorNoticeShown(staticData, false);
}

export function articleToOutputItem(item: NewsItem): IDataObject {
	return itemToJson(item);
}

export function pollErrorNoticeItem(message: string): IDataObject {
	return {
		event: 'pollError',
		message,
	};
}

/**
 * Advance the News item-id cursor for the next page, or `undefined` when
 * paging should stop (partial page / missing cursor / non-advancing cursor).
 */
export function nextTriggerPageOffset(
	items: NewsItem[],
	offset: number,
	previousOffset: number | undefined,
): number | undefined {
	if (items.length < TRIGGER_ITEMS_BATCH_SIZE) {
		return undefined;
	}

	const nextOffset = nextNewsOffsetFromItems(items);
	if (nextOffset === undefined) {
		return undefined;
	}

	// Inclusive cursors can repeat the boundary id; stop if we would not advance.
	if (previousOffset !== undefined && nextOffset >= previousOffset) {
		return undefined;
	}
	if (offset !== 0 && nextOffset >= offset) {
		return undefined;
	}

	return nextOffset;
}

export async function loadTriggerItemsPage(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	offset: number = 0,
): Promise<NewsItem[]> {
	const qs = buildNewsItemsQueryParams({
		batchSize: TRIGGER_ITEMS_BATCH_SIZE,
		offset,
		type: scope.type,
		id: scope.id,
		getRead: scope.getRead,
		oldestFirst: false,
	});

	return unwrapItems(await newsRequest(context, 'GET', '/items', { qs }));
}

/** Single newest page (offset 0) — used by manual mode. */
export async function loadTriggerItems(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
): Promise<NewsItem[]> {
	return loadTriggerItemsPage(context, scope, 0);
}

/**
 * Seed/re-seed: walk News `offset` pages until a partial/empty page so the ID
 * window covers the current backlog (not only the newest 100).
 */
export async function loadAllTriggerItemsForSeed(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
): Promise<NewsItem[]> {
	const collected: NewsItem[] = [];
	let offset = 0;
	let previousOffset: number | undefined;

	for (let page = 0; page < TRIGGER_SEED_MAX_PAGES; page++) {
		const items = await loadTriggerItemsPage(context, scope, offset);
		if (items.length === 0) {
			break;
		}

		collected.push(...items);

		if (collected.length >= DEFAULT_MAX_PROCESSED_IDS) {
			return collected.slice(0, DEFAULT_MAX_PROCESSED_IDS);
		}

		const nextOffset = nextTriggerPageOffset(items, offset, previousOffset);
		if (nextOffset === undefined) {
			break;
		}

		previousOffset = offset;
		offset = nextOffset;
	}

	return collected;
}

/**
 * Steady-state: load the newest page, then keep paging while every item on a
 * full page is unseen (burst larger than {@link TRIGGER_ITEMS_BATCH_SIZE}).
 * Stop when a page includes an already-processed id, is partial/empty, or the
 * per-poll page cap is hit.
 */
export async function loadTriggerItemsWithCatchUp(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
	staticData: IDataObject,
): Promise<NewsItem[]> {
	const processed = new Set(getProcessedIds(staticData));
	const collected: NewsItem[] = [];
	let offset = 0;
	let previousOffset: number | undefined;

	for (let page = 0; page < TRIGGER_STEADY_MAX_PAGES; page++) {
		const items = await loadTriggerItemsPage(context, scope, offset);
		if (items.length === 0) {
			break;
		}

		collected.push(...items);

		const hasSeen = items.some((item) => processed.has(String(item.id)));
		if (hasSeen) {
			break;
		}

		const nextOffset = nextTriggerPageOffset(items, offset, previousOffset);
		if (nextOffset === undefined) {
			break;
		}

		previousOffset = offset;
		offset = nextOffset;
	}

	return collected;
}

export async function runNewsPoll(
	context: IPollFunctions,
): Promise<INodeExecutionData[][] | null> {
	const staticData = context.getWorkflowStaticData('node');
	const isManual = context.getMode() === 'manual';
	const requestContext = asLoadOptionsContext(context);

	let credentials: NextcloudCredentialData;
	let pollScope: NewsPollScope;
	let resolved: NewsPollScopeResolved;

	try {
		credentials = await getCredentials(requestContext);
		pollScope = readPollScopeFromNode(context);
		resolved = resolveNewsPollScope(pollScope);
	} catch (error) {
		throwPollError(context, scrubErrorMessage(error));
	}

	const isInitialized = isNewsPollInitialized(staticData, resolved.scopeKey);

	let items: NewsItem[];
	try {
		if (!isManual && !isInitialized) {
			items = await loadAllTriggerItemsForSeed(requestContext, resolved);
		} else if (!isManual && isInitialized) {
			items = await loadTriggerItemsWithCatchUp(requestContext, resolved, staticData);
		} else {
			items = await loadTriggerItemsPage(requestContext, resolved, 0);
		}
	} catch (error) {
		const scrubbedMessage = scrubErrorMessage(error, credentials);

		if (isInitialized) {
			context.logger.debug(
				`Nextcloud News Trigger: listing failed after initialization; soft-failing poll (${scrubbedMessage})`,
			);

			if (isPollErrorNoticeShown(staticData)) {
				return null;
			}

			setPollErrorNoticeShown(staticData, true);
			return [context.helpers.returnJsonArray([pollErrorNoticeItem(scrubbedMessage)])];
		}

		throwPollError(context, scrubbedMessage);
	}

	// Successful listing clears the soft-fail notice window.
	setPollErrorNoticeShown(staticData, false);

	if (isManual) {
		const sample = items[0];
		if (!sample) {
			context.logger.debug(
				'Nextcloud News Trigger: manual sample unavailable (no matching articles). Returning null.',
			);
			return null;
		}

		return [context.helpers.returnJsonArray([articleToOutputItem(sample)])];
	}

	if (!isInitialized) {
		seedNewsPollState(staticData, resolved.scopeKey, items);
		return null;
	}

	const candidateIds = items.map((item) => String(item.id));
	const { unseenIds } = filterIdsInStaticData(candidateIds, staticData);
	staticData[LAST_TIME_CHECKED_KEY] = new Date().toISOString();

	if (unseenIds.length === 0) {
		return null;
	}

	const unseenSet = new Set(unseenIds);
	const newArticles = items.filter((item) => unseenSet.has(String(item.id)));

	if (newArticles.length === 0) {
		return null;
	}

	return [context.helpers.returnJsonArray(newArticles.map(articleToOutputItem))];
}

/** Exported for tests that need to inspect the processed-id window. */
export function getProcessedArticleIds(staticData: IDataObject): string[] {
	return getProcessedIds(staticData);
}
