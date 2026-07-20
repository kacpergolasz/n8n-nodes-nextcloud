<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Nextcloud News (actions + polling trigger)

- **Plan**: context/changes/nextcloud-news/plan.md
- **Scope**: Phase 1–5 of 5 (full plan)
- **Date**: 2026-07-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Item Get Many returns envelope, not one item per article

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudNews/resources/item/getAll.ts:57-97
- **Detail**: Phase 3 contract and Desired End State require one n8n item per article (full JSON). Implementation returns a single execution item `{ items: [...], nextOffset }` and tests lock that shape. Cursor pagination itself is correct (real `GET /items` via shared helpers, not fetch-all-slice). UI also replaces raw `batchSize`/`type`/`id`/`getRead` with `limit` + folder/feed/`starredOnly`/`unreadOnly` convenience filters (plan allowed presets that set defaults; raw API fields are not exposed).
- **Fix A ⭐ Recommended**: Keep the envelope (better paging UX / never-empty execution) and document the intentional drift as a plan addendum / node description note so future reviews treat it as accepted.
  - Strength: Preserves working pagination UX and `nextOffset` hand-off; avoids churn for already-smoked workflows.
  - Tradeoff: Diverges from suite “one row per entity” Get Many convention.
  - Confidence: HIGH — envelope is deliberate (comment at getAll.ts:57-58) and covered by tests.
  - Blind spot: Downstream workflows expecting Split Out / item-linked pairing on Get Many.
- **Fix B**: Change `itemGetAll` to return one n8n item per article and put `nextOffset` in paired metadata or a second output / binary companion field.
  - Strength: Matches plan and suite Get Many norms.
  - Tradeoff: Breaks any workflow relying on the envelope; empty pages become zero items.
  - Confidence: MEDIUM — need a clear place for `nextOffset` without the envelope.
  - Blind spot: Whether manual smoke workflows already depend on `{ items, nextOffset }`.
- **Decision**: Fixed via Fix A

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNewsTrigger/pollNews.ts:31-32, 169-183, 243-245
- **Detail**: Init/re-seed and steady polls share `TRIGGER_ITEMS_BATCH_SIZE = 100`. With Unread Only (default) and >100 unread items, only the newest 100 IDs are seeded. When newer unread items are marked read elsewhere, older pre-existing unread IDs enter the newest-100 window and can fire as new — a delayed history flood vs “no history flood on activate.”
- **Fix A ⭐ Recommended**: On seed/re-seed only, page with `offset` until exhausted (or a larger one-shot batch), keeping `100` for steady-state polls.
  - Strength: Closes the late-flood class without making every poll expensive.
  - Tradeoff: Activation can be slower on huge unread inboxes.
  - Confidence: HIGH — matches plan Performance guidance (bounded steady poll; seed completeness separate).
  - Blind spot: Upper bound / timeout if unread history is enormous (`batchSize=-1` risk).
- **Fix B**: Document the newest-100 seed ceiling in the node description and accept the limitation for MVP.
  - Strength: No code change; honest author guidance.
  - Tradeoff: Leaves the late-flood bug class live for large inboxes.
  - Confidence: MEDIUM — acceptable only if typical News inboxes stay small.
  - Blind spot: Real inbox sizes on target instances.
- **Decision**: Fixed via Fix A

### F3 — Steady-state poll can permanently miss bursts larger than 100 new articles

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNewsTrigger/pollNews.ts:31-32, 173-180
- **Detail**: Each production poll only lists the newest 100 matching items. If more than 100 new articles arrive between ticks, older new IDs never appear in later newest-100 pages and are never emitted.
- **Fix A ⭐ Recommended**: Document the per-poll burst ceiling (100) in the trigger description / follow-ups note.
  - Strength: Cheap; matches the plan’s intentional bounded candidate fetch.
  - Tradeoff: Does not recover missed IDs.
  - Confidence: HIGH — plan explicitly wanted bounded polls.
  - Blind spot: Whether high-volume feeds are in scope for S-06 users.
- **Fix B**: Catch up by paging while unseen IDs remain, with a per-poll page cap.
  - Strength: Reduces false negatives under bursty feeds.
  - Tradeoff: More API load; more complex poll loop/tests.
  - Confidence: MEDIUM — needs careful interaction with ID-window max size.
  - Blind spot: Interaction with `filterIdsInStaticData` window eviction.
- **Decision**: Fixed via Fix B

### F4 — Invalid `batchSize` normalizes to `-1` (fetch all)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/shared/pagination.ts:65-79 (consumed by item/getAll.ts:77-78)
- **Detail**: `normalizeNewsBatchSize` maps `0`, other negatives, and non-finite values to `DEFAULT_NEWS_BATCH_SIZE` (`-1` = all). Item Get Many passes UI/`limit` through this helper, so an expression resolving to `0`/`NaN` silently becomes an unbounded history pull — the risk the plan’s Performance section flags. UI `limit` has `minValue: 1`, so the static UI path is safe; expression path is not.
- **Fix**: Fall back invalid / non-positive (except explicit `-1`) values to a positive default (e.g. `DEFAULT_CLIENT_LIMIT` / 50); preserve `-1` only when explicitly requested.
- **Decision**: Fixed

### F5 — Soft-fail scrub may lack credentials on pre-listing failures

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNewsTrigger/pollNews.ts:200-201
- **Detail**: Pre-listing failures call `scrubErrorMessage(error)` without credentials (same as Files Trigger). Basic-auth regexes still help; password-substring redaction may not run if `getCredentials` itself threw with a secret in the message.
- **Fix**: Best-effort load credentials in the catch before scrubbing (as listSearch does), or scrub with any partially available secret material.
- **Decision**: PENDING

### F6 — Favicon always reports `image/x-icon` MIME

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudNews/resources/feed/favicon.ts:35-36
- **Detail**: Binary path is correct (`json: false`, `arraybuffer`), but MIME is hardcoded to `image/x-icon` even when the bytes are PNG/SVG.
- **Fix**: Infer MIME from response headers or magic bytes when present.
- **Decision**: PENDING

### F7 — Shared soft-fail bullet still describes Files-only `return null`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md:12
- **Detail**: Shared conventions still say soft-fail returns `null`. The News subsection correctly documents the one-shot notice-item pattern. Future app authors reading only the shared bullet may miss decision 8B.
- **Fix**: Update the shared soft-fail bullet to mention optional one-shot notice item (News pattern) vs silent `null` (Files).
- **Decision**: PENDING

## Triage notes

- 2026-07-20: F1–F4 fixed; triage paused (context clear). Resume with `/10x-impl-review context/changes/nextcloud-news/reviews/impl-review.md` for F5–F7.
