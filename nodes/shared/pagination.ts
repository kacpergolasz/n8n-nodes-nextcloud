import type { IDataObject } from 'n8n-workflow';

/** Default client-side page size when `returnAll` is false (suite convention). */
export const DEFAULT_CLIENT_LIMIT = 50;

/**
 * News API `batchSize`: `-1` means return all matching items (dangerous on large
 * instances). Positive values page the response.
 */
export const NEWS_BATCH_SIZE_ALL = -1;

/**
 * News API wire default when `batchSize` is omitted from the request.
 * Our helpers never omit it: {@link normalizeNewsBatchSize} falls back to
 * {@link DEFAULT_CLIENT_LIMIT} unless the caller passes explicit `-1`.
 */
export const DEFAULT_NEWS_BATCH_SIZE = NEWS_BATCH_SIZE_ALL;

/** News API default `offset` (item id cursor); `0` starts from the newest. */
export const DEFAULT_NEWS_OFFSET = 0;

/** Coerce expression / static-data values that may arrive as numeric strings. */
export type NewsNumericInput = number | string | null | undefined;

/**
 * Parse a finite number from node params / static data. Accepts numbers and
 * numeric strings (common when chaining `nextOffset` via expressions).
 * Empty / non-numeric → `undefined` (caller decides the fallback).
 */
export function coerceFiniteNumber(value: unknown): number | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === '') {
			return undefined;
		}
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
}

/**
 * Client-limit mode: when the API returns a full list, optionally slice to
 * `limit`. Prefer this over ad-hoc `.slice(0, limit)` in Get Many handlers.
 * Does not call the remote API — pure array shaping for small list endpoints.
 */
export function applyReturnAllLimit<T>(
	items: T[],
	returnAll: boolean,
	limit: NewsNumericInput = DEFAULT_CLIENT_LIMIT,
): T[] {
	if (returnAll) {
		return items;
	}

	const coerced = coerceFiniteNumber(limit);
	const safeLimit =
		coerced !== undefined && coerced > 0 ? Math.floor(coerced) : DEFAULT_CLIENT_LIMIT;
	return items.slice(0, safeLimit);
}

/** News `GET /items` type enum (Feed / Folder / Starred / All). */
export type NewsItemsQueryType = 0 | 1 | 2 | 3;

export type NewsItemsCursorParams = {
/**
 * Page size. Explicit `-1` = all items. Positive integers page.
 * Omitted / null / non-finite / zero / other non-positive values fall back to
 * {@link DEFAULT_CLIENT_LIMIT} (never silently to `-1` — blank expression
 * results must not unbounded-pull).
 * Numeric strings are coerced (expression chaining).
 */
	batchSize?: NewsNumericInput;
	/**
	 * Item-id cursor: only return items with id ≤ this value (older-or-equal).
	 * After a page, set the next `offset` to the **lowest** item id from that
	 * page (see News autopaging docs). `0` / omitted starts from the newest.
	 * Numeric strings are coerced (expression chaining).
	 */
	offset?: NewsNumericInput;
	/** Feed: 0, Folder: 1, Starred: 2, All: 3 */
	type?: NewsItemsQueryType;
	/** Folder or feed id; use `0` for Starred and All */
	id?: number;
	/** `true` = all items; `false` = unread only */
	getRead?: boolean;
	/** Reverse sort order (oldest first) */
	oldestFirst?: boolean;
};

/**
 * Normalize News `batchSize`. Preserves explicit `-1` (all) only when
 * requested. Omitted / null / empty strings / invalid values (`NaN`, `0`,
 * other negatives) → {@link DEFAULT_CLIENT_LIMIT} so typos and blank
 * expression results cannot unbounded-pull. Coerces numeric strings from
 * expression results.
 */
export function normalizeNewsBatchSize(batchSize?: NewsNumericInput): number {
	const coerced = coerceFiniteNumber(batchSize);
	if (coerced === undefined) {
		return DEFAULT_CLIENT_LIMIT;
	}

	const n = Math.trunc(coerced);
	if (n === NEWS_BATCH_SIZE_ALL) {
		return NEWS_BATCH_SIZE_ALL;
	}

	if (n < 1) {
		return DEFAULT_CLIENT_LIMIT;
	}

	return n;
}

/**
 * Normalize News `offset` (item id cursor). Non-finite / negative →
 * {@link DEFAULT_NEWS_OFFSET}. Coerces numeric strings from expression results.
 */
export function normalizeNewsOffset(offset?: NewsNumericInput): number {
	const coerced = coerceFiniteNumber(offset);
	if (coerced === undefined) {
		return DEFAULT_NEWS_OFFSET;
	}

	const n = Math.trunc(coerced);
	return n < 0 ? DEFAULT_NEWS_OFFSET : n;
}

/**
 * Build query/body params for News `GET /items` (and compatible list calls).
 * Always includes normalized `batchSize` and `offset`; optional filters are
 * only present when provided by the caller.
 */
export function buildNewsItemsQueryParams(params: NewsItemsCursorParams = {}): IDataObject {
	const query: IDataObject = {
		batchSize: normalizeNewsBatchSize(params.batchSize),
		offset: normalizeNewsOffset(params.offset),
	};

	if (params.type !== undefined) {
		query.type = params.type;
	}

	if (params.id !== undefined) {
		query.id = params.id;
	}

	if (params.getRead !== undefined) {
		query.getRead = params.getRead;
	}

	if (params.oldestFirst !== undefined) {
		query.oldestFirst = params.oldestFirst;
	}

	return query;
}

export type NewsItemIdCarrier = {
	id: number;
};

/**
 * Compute the next News `offset` cursor from a returned page: the **lowest**
 * item id (per News autopaging). Returns `undefined` for an empty page
 * (no further pages to request with this strategy).
 */
export function nextNewsOffsetFromItems(items: NewsItemIdCarrier[]): number | undefined {
	if (items.length === 0) {
		return undefined;
	}

	let minId = items[0].id;
	for (let i = 1; i < items.length; i++) {
		const id = items[i].id;
		if (id < minId) {
			minId = id;
		}
	}

	return minId;
}
