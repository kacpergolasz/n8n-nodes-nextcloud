# `pollNews.ts` — collected review comments

Compiled from impl-review, Bugbot runs, and prior agent sessions (2026-07-20 – 2026-07-21).

## Summary

| ID | Title | Severity | Location | Status |
|----|-------|----------|----------|--------|
| B1 | Peek exhausted clears pending catch-up | high | `459-461` | **Open** |
| B2 | Unread status changes fire falsely | high | seed / `637-653` | Fixed |
| B3 | Pending catch-up dropped on burst | high | `loadTriggerItemsWithCatchUp` (pre-remodel) | Fixed (remodel) |
| B4 | Resume stops on `processedIds` / known territory | high | `531-538` | Mitigated (remodel) |
| B5 | Catch-up cleared before requests; lost on soft-fail | high | `runNewsPoll` (pre-remodel) | Fixed (remodel) |
| B6 | Duplicate article on consecutive pages | medium | catch-up collect (pre-remodel) | Fixed (`seenIds`) |
| B7 | `nextTriggerPageOffset` aborts after page 1 | high | `308-327` | Fixed |
| B8 | Ring-buffer eviction re-fires articles | medium | `637-653` + `pollHelpers` | Mitigated (`maxProcessedId`) |
| B9 | Locator ignores bare numeric expressions | medium | `120-143` | Fixed |
| IR-F2 | Seed newest-100 can late-fire unread backlog | warning | `33-42`, `391-419` | Fixed |
| IR-F3 | Steady poll misses bursts >100 | warning | `44-48`, `431-486` | Fixed (catch-up paging) |
| IR-F5 | Soft-fail scrub lacks credentials | observation | `571-578` | Fixed |
| FR | Incoherent catch-up state model | — | whole file | Addressed (remodel) |

---

## Open

### B1 — Peek exhausted clears pending catch-up

**Source:** Bugbot (`/review-bugbot`, 2026-07-21)

**Severity:** high

**Finding:** When steady-state polling still has a persisted `catchUpOffset`, the top-of-feed peek phase can finish with reason `exhausted` (partial or empty page) and `loadTriggerItemsWithCatchUp` immediately calls `clearCatchUpState` and returns without running the resume pass from that offset. The watermark is then advanced from peek results only, so unread articles in the older gap between the watermark and the saved offset are never listed or emitted.

**Rationale:** Resume is intentionally split into a peek from offset 0 and a second walk from `catchUpOffset` toward the watermark. The early return treats peek `exhausted` the same as a completed catch-up, even when `priorOffset` is still set. That happens whenever the newest unread page is partial or empty while all newer matching articles are read — e.g. a pending resume at 151 after a large burst, then a poll where only a small newer unread slice (or none) appears at offset 0 because `unreadOnly` hides read headlines above the gap. Tests cover multi-page resume after page-cap `incomplete`, but not peek `exhausted` with a non-empty `catchUpOffset`.

**Code:**

```459:462:nodes/NextcloudNewsTrigger/pollNews.ts
	if (newest.reason === 'watermark' || newest.reason === 'exhausted') {
		clearCatchUpState(staticData);
		return collected;
	}
```

The resume pass that should still run when `priorOffset` is set:

```464:477:nodes/NextcloudNewsTrigger/pollNews.ts
	// Reached resume frontier / known territory from the top — continue toward W.
	if (priorOffset !== undefined && pagesLeft > 0) {
		const resumed = await collectCatchUpPages(context, scope, collected, seenIds, {
			startOffset: priorOffset,
			stopAtOrBelowId: watermark,
			processedIds,
			maxPages: pagesLeft,
		});
		// ...
	}
```

**Suggested fix direction:** Only clear catch-up and return early on peek `exhausted` when `priorOffset === undefined`. When a resume cursor exists, fall through to the resume pass (or treat peek `exhausted` like `frontier`).

---

## Fixed — Bugbot

### B2 — Unread status changes fire falsely (mark-unread false positive)

**Source:** Bugbot (2026-07-20, `pollNews.ts:619`)

**Severity:** high · **Status:** Fixed

**Finding:** Seeding `maxProcessedId` from unread-only listings left the watermark below pre-existing read article ids. When those articles were later marked unread they passed `id > watermark` and fired the workflow even though no new article was created.

**Fix:** On unread-only seed/re-seed, raise the watermark from the newest all-items page (`getRead: true`) while keeping steady-state polls unread-filtered.

**Code:**

```370:385:nodes/NextcloudNewsTrigger/pollNews.ts
/**
 * Newest-page max article id for the folder/feed scope with `getRead: true`.
 * Used on unread-only seed so the watermark covers pre-existing read articles
 * (avoids false-fire when those are later marked unread).
 */
export async function loadScopeMaxArticleId(
	context: ILoadOptionsFunctions,
	scope: NewsPollScopeResolved,
): Promise<number> {
	const newestAll = await loadTriggerItemsPage(
		context,
		{ ...scope, getRead: true },
		0,
	);
	return maxArticleId(newestAll);
}
```

```587:592:nodes/NextcloudNewsTrigger/pollNews.ts
		if (!isManual && !isInitialized) {
			items = await loadAllTriggerItemsForSeed(requestContext, resolved);
			// Unread listings omit read articles; raise W from newest all-items page.
			if (!resolved.getRead) {
				seedScopeMaxId = await loadScopeMaxArticleId(requestContext, resolved);
			}
```

```263:284:nodes/NextcloudNewsTrigger/pollNews.ts
export function seedNewsPollState(
	staticData: IDataObject,
	scopeKey: string,
	items: NewsItem[],
	now: number = Date.now(),
	maxProcessedId?: number,
): void {
	// ...
	const itemsMax = maxArticleId(items);
	setMaxProcessedId(
		staticData,
		maxProcessedId !== undefined ? Math.max(itemsMax, maxProcessedId) : itemsMax,
	);
```

**Tests:** `raises watermark from all-items newest page so remade-unread does not fire`, `still emits truly new unread articles after unread-only seed with raised watermark`.

---

### B3 — Pending catch-up dropped on burst (resume cursor overwritten)

**Source:** Bugbot (2026-07-20, pre-remodel `412-414`)

**Severity:** high · **Status:** Fixed (catch-up remodel)

**Finding:** When a prior poll left a resume cursor and the current poll's newest scan hit the per-poll page cap, catch-up state was overwritten with the newest scan's offset; the saved prior offset/until pair was abandoned. A second large burst during in-progress catch-up could permanently skip articles.

**Fix:** Remodel split steady catch-up into peek-from-0 + resume-from-`catchUpOffset`, with durable `CATCH_UP_OFFSET_KEY` that survives soft-fail. Watermark advances only after catch-up completes.

**Code (current model):**

```422:430:nodes/NextcloudNewsTrigger/pollNews.ts
/**
 * Steady-state: walk newest → older toward the watermark with a per-poll page
 * budget. ...
 * With a pending resume R: peek from offset 0 for a newer burst, then continue
 * from R toward W so already-fetched pages are not re-walked within the budget.
 */
```

```643:648:nodes/NextcloudNewsTrigger/pollNews.ts
	// Raise W only after catch-up fully reached the prior watermark (no resume left).
	if (getCatchUpOffset(staticData) === undefined) {
		const fetchedMax = maxArticleId(items);
		if (fetchedMax > watermark) {
			setMaxProcessedId(staticData, fetchedMax);
```

---

### B6 — Duplicate article on consecutive pages

**Source:** Bugbot (2026-07-20, pre-remodel `399-406`)

**Severity:** medium · **Status:** Fixed

**Finding:** Inclusive offset catch-up could return the same article on consecutive pages; `runNewsPoll` never deduped by id, so one article could emit multiple execution items in a single poll.

**Fix:** `appendUniqueNewsItems` + `seenIds` set during catch-up collection.

---

### B7 — `nextTriggerPageOffset` aborts paging after page 1

**Source:** Bugbot (2026-07-20, `203-205` at time of report)

**Severity:** high · **Status:** Fixed

**Finding:** Paging stopped when `nextOffset >= offset`; after page 1 (`offset` 0) that was always true for normal positive ids, so a third page was never requested.

**Fix:** Only apply the non-advancing guard when `offset !== 0`.

```301:327:nodes/NextcloudNewsTrigger/pollNews.ts
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
): number | undefined {
	// ...
	// Inclusive cursors can repeat the boundary id; stop if we would not move older.
	if (offset !== 0 && nextOffset >= offset) {
		return undefined;
	}
```

---

### B9 — Locator ignores bare numeric expressions

**Source:** Bugbot (2026-07-20, `99-116` at time of report)

**Severity:** medium · **Status:** Fixed

**Finding:** Trigger locator helper only read `locator.value`; bare numeric expression results were ignored and scope fell back to all feeds.

**Fix:** `resolveOptionalLocatorId` accepts RLC `{ value }` or bare numeric/string expression results.

```120:143:nodes/NextcloudNewsTrigger/pollNews.ts
export function resolveOptionalLocatorId(
	context: IPollFunctions,
	paramName: string,
	resourceLabel: string,
): number | undefined {
	const raw = context.getNodeParameter(paramName) as unknown;
	// Match actions-node getLocatorValue: accept RLC `{ value }` or bare
	// numeric/string expression results (e.g. `={{ $json.id }}` → number).
	const value =
		raw !== null && typeof raw === 'object' && 'value' in (raw as object)
			? (raw as INodeParameterResourceLocator).value
			: raw;
```

---

## Fixed / mitigated — remodel analysis (2026-07-20)

Prior to the catch-up remodel, a frame investigation identified four permanent-skip / re-fire paths sharing one root cause: overlapping "seen" stores (watermark + ring + catch-up offset/until) with conflicting advance rules.

| Issue | Severity | Why it skipped / misfired | Status |
|-------|----------|---------------------------|--------|
| Prior catch-up overwritten when newest scan hits page cap | high | Resume cursor discarded | Fixed → B3 |
| Resume stops on inclusive boundary ∈ `processedIds` | high | Resume page never reached `untilId`; watermark advanced | Mitigated: stop on `id ≤ watermark` only; `knownTerritory` ends peek phase, not catch-up |
| Catch-up cleared before requests; lost on soft-fail | high | Next success thought catch-up done → watermark jumped | Fixed: `catchUpOffset` persists across soft-fail |
| Re-fire if ring evicts ids above held-back watermark | medium | At-least-once became twice | Mitigated: `maxProcessedId` high-water mark |

**`knownTerritory` stop (peek phase only):**

```531:538:nodes/NextcloudNewsTrigger/pollNews.ts
		if (resumeFrontier !== undefined) {
			const reachedFrontier = items.some((item) => item.id <= resumeFrontier);
			const knownTerritory = items.every((item) =>
				processedIds.has(String(item.id)),
			);
			if (reachedFrontier || knownTerritory) {
				return { status: 'complete', reason: 'frontier', pagesUsed };
			}
		}
```

**Ring-buffer eviction test:**

```587:592:nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts
	it('does not re-emit articles after processed-id window eviction', async () => {
		// ...
		// Simulate ring-buffer eviction of id 100 while watermark remains.
```

---

## Implementation review (`impl-review.md`, 2026-07-20)

### IR-F2 — Trigger seed newest-100 can late-fire large unread backlog

**Severity:** warning · **Status:** Fixed (Fix A)

**Detail:** Init/re-seed and steady polls shared `TRIGGER_ITEMS_BATCH_SIZE = 100`. With Unread Only (default) and >100 unread items, only the newest 100 IDs were seeded. When newer unread items were marked read elsewhere, older pre-existing unread IDs entered the newest-100 window and could fire as new — a delayed history flood vs "no history flood on activate."

**Fix:** On seed/re-seed only, page with `offset` until exhausted (capped by `TRIGGER_SEED_MAX_PAGES`).

```33:42:nodes/NextcloudNewsTrigger/pollNews.ts
/** Bounded page of newest candidates per poll (avoids unbounded history pulls). */
export const TRIGGER_ITEMS_BATCH_SIZE = 100;

/**
 * Seed/re-seed only: max pages when walking `offset` so huge inboxes cannot
 * hang activation. Aligns with the processed-id window ceiling.
 */
export const TRIGGER_SEED_MAX_PAGES = Math.ceil(
	DEFAULT_MAX_PROCESSED_IDS / TRIGGER_ITEMS_BATCH_SIZE,
);
```

```387:419:nodes/NextcloudNewsTrigger/pollNews.ts
/**
 * Seed/re-seed: walk News `offset` pages until a partial/empty page so the ID
 * window covers the current backlog (not only the newest 100).
 */
export async function loadAllTriggerItemsForSeed(/* ... */) { /* ... */ }
```

---

### IR-F3 — Steady-state poll can permanently miss bursts larger than 100

**Severity:** warning · **Status:** Fixed (Fix B — catch-up paging)

**Detail:** Each production poll only listed the newest 100 matching items. If more than 100 new articles arrived between ticks, older new IDs never appeared in later newest-100 pages and were never emitted.

**Fix:** Catch up by paging while unseen IDs remain, with a per-poll page cap (`TRIGGER_STEADY_MAX_PAGES = 10`); persist `catchUpOffset` to resume.

```44:48:nodes/NextcloudNewsTrigger/pollNews.ts
/**
 * Steady-state catch-up: max pages per poll when a burst of new articles fills
 * the newest page (avoids permanently missing older new ids).
 */
export const TRIGGER_STEADY_MAX_PAGES = 10;
```

```63:68:nodes/NextcloudNewsTrigger/pollNews.ts
/**
 * When a per-poll catch-up hits {@link TRIGGER_STEADY_MAX_PAGES} before reaching
 * the watermark, resume from this offset on the next poll so mid-burst articles
 * are not permanently skipped. Cleared only after catch-up observes an id ≤ W
 * (or the list is exhausted). Survives soft-fail.
 */
export const CATCH_UP_OFFSET_KEY = 'catchUpOffset';
```

Documented in `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md` (steady catch-up row).

---

### IR-F5 — Soft-fail scrub may lack credentials on pre-listing failures

**Severity:** observation · **Status:** Fixed

**Detail:** Pre-listing failures called `scrubErrorMessage(error)` without credentials. Password-substring redaction might not run if `getCredentials` itself threw with a secret in the message.

**Fix:**

```571:578:nodes/NextcloudNewsTrigger/pollNews.ts
	} catch (error) {
		let secrets = {};
		try {
			secrets = await getCredentials(requestContext);
		} catch {
			// ignore credential load failures while scrubbing
		}
		throwPollError(context, scrubErrorMessage(error, secrets));
	}
```

---

## Design notes (suite docs)

From `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md`:

- **Init / scope gate:** First production poll (or folder/feed filter change) pages to seed processed ids (not only newest 100) and returns `null` (no history flood).
- **Steady catch-up:** Page size 100; newest→older walk toward `maxProcessedId` until id ≤ watermark, empty/exhausted list, or per-poll page cap. Cap persists `catchUpOffset` (resume survives soft-fail); raise watermark only after catch-up completes. Ring buffer dedupes only — it does not end catch-up. Emit new ids ascending.
- **Poll entry:** `pollNews.ts` → `runNewsPoll`

---

## Historical Bugbot note (likely false positive / superseded)

**Catch-up stops after 10 pages (~1000 ids)** (`pollNews.ts:48-327`, Bugbot 2026-07-20): Reported as permanent skip because later polls "restart at offset 0". Superseded by the remodel: the 10-page cap is intentional (`TRIGGER_STEADY_MAX_PAGES`); unfinished work persists via `catchUpOffset` and resumes next poll. Remaining gap: B1 (peek `exhausted` clears resume).
