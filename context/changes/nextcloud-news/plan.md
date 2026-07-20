# Nextcloud News (actions + polling trigger) Implementation Plan

## Overview

Implement roadmap **S-06 / FR-008**: a **Nextcloud News** actions node (API v1.3) plus a **Nextcloud News Trigger** that polls for newly seen articles, reusing `nextcloudApi` and mirroring Deck (JSON REST) + the Files Trigger / `pollHelpers` suite pattern from master. News also introduces **shared pagination helpers** (real `batchSize`/`offset` for items); suite-wide retrofit of other apps is **S-15**, not this change. API v2 stays **S-14**.

## Current State Analysis

- Shared Basic Auth credential `nextcloudApi` is proven (S-01). Deck/Files/Calendar action nodes exist; this worktree tip may lag `origin/master`, which already ships `nodes/shared/pollHelpers.ts` and `NextcloudFilesTrigger` (S-07).
- **No** `NextcloudNews` / `NextcloudNewsTrigger` code yet.
- News API v1.3 is JSON REST at `{baseUrl}/index.php/apps/news/api/v1-3/` with Basic Auth — same family as Deck, not OCS/WebDAV. Docs: https://nextcloud.github.io/news/api/api-v1-3/
- Research (`context/changes/nextcloud-news/research.md`) settled auth, endpoint catalogue, and Deck-as-template; open doc inconsistencies (bulk mark method/body) must be verified against live routes / `appinfo/routes.php` during implementation.
- Suite `getAll` today is fetch-all + `.slice(0, limit)` — News Item Get Many must not repeat that for items.

### Key Discoveries:

- Closest actions template: `nodes/NextcloudDeck/` (`deckApiBase` / `deckRequest`, `resources/*/`, listSearch, scrub/httpStatus).
- Closest trigger template: `nodes/NextcloudFilesTrigger/` + `nodes/shared/pollHelpers.ts` (`filterIdsInStaticData` for ID-window “new article” detection) — see `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md` on master.
- Item fields include stable `id` and `lastModified`; trigger MVP is **new ids only**, with optional **Unread only** filter.
- Favicon is binary (`GET /favicon/{md5(feedUrl)}`); mark-feed-read needs `newestItemId`.

## Desired End State

A workflow author can:

1. Attach the shared **Nextcloud API** credential to **Nextcloud News** and run Folder / Feed / Item operations (including mark feed read + favicon), with Item Get Many using real News `batchSize`/`offset` pagination.
2. Add **Nextcloud News Trigger**, optionally scope by folder and/or feed, optionally **Unread only**, and receive **one full article JSON item per new article** (no history flood on first activate; Test step returns a sample).
3. After init, transient poll failures soft-fail and surface **at most one notice item** until the next successful poll clears the notice state; secrets never leak.
4. Package registers both nodes; Vitest covers helpers + poll classification; `npm run build && npm run lint && npm test` green; F-01 local link finds both nodes.

### Key Discoveries:

- Trigger packaging: **one Trigger class per app** (`NextcloudNewsTrigger`), `polling: true`, no hand-authored `pollTimes`.
- Pagination: shared module under `nodes/shared/`; News items are the first cursor consumer; Folder/Feed Get Many may still use the shared client-limit helper for small lists.
- Prefer detailed v1.3 endpoint table (POST + `itemIds`) over the sync-overview PUT wording when wiring bulk mark routes.

## What We're NOT Doing

- News API **v2** (roadmap **S-14**).
- Retrofitting Deck/Files/Calendar Get Many (roadmap **S-15**).
- Admin updater / cleanup / `GET /feeds/all`, deprecated `GET /user`, feed keyword `/filter`, mark-folder-read, global mark-all-items (`POST /items/read`), trigger delete detection, OAuth2 (S-02).
- Live Nextcloud in CI; npm publish; forking zahidcoder.
- Changing Files Trigger behavior beyond consuming shared helpers already on master.

## Implementation Approach

1. Merge/rebase onto `origin/master` so `pollHelpers` + Files Trigger pattern exist.
2. Add `nodes/shared/pagination.ts` (+ tests) documenting cursor vs client-limit modes; News Item Get Many uses cursor mode.
3. Scaffold `NextcloudNews` like Deck: `newsApiBase` → `/index.php/apps/news/api/v1-3`, `newsRequest`, resources folder/feed/item, listSearch, scrub copies.
4. Scaffold `NextcloudNewsTrigger`: ID-window via `filterIdsInStaticData`, optional folder/feed locators + unread checkbox, soft-fail + one-shot error notice item, manual sample-1.
5. Register both nodes; unit-test pure helpers and mocked `poll()`; manual smoke on a News-enabled instance.

## Critical Implementation Details

- **Verify bulk mark routes** against a live News app or upstream `appinfo/routes.php` before locking handler paths (docs disagree between sync overview and endpoint table). Prefer POST `/items/{read|unread|star|unstar}/multiple` with `{ itemIds }`.
- **Trigger init**: first production poll seeds processed-id window (and scope keys) and returns `null` — never flood history. Re-seed when folder/feed filter selection changes (mirror Files `watchedFolder` gate).
- **Soft-fail notice (decision 8B)**: after initialization, on listing errors scrub secrets, debug-log, return a **single** notice item (`event: 'pollError'`, scrubbed `message`) only if notice not already shown for this failure window; **do not** advance the ID window; clear notice flag on the next successful poll. Manual mode: sample item or `null` — do not throw empty-folder errors that can kill crons.
- **Favicon**: treat response as binary; output binary data (and metadata) rather than forcing JSON.
- **`OCS-APIRequest`**: not required by News docs; start with `json: true` + Accept/Content-Type JSON; add OCS header only if live instance demands it.

## Phase 1: Merge master + shared pagination foundations

### Overview

Bring this branch onto current master (poll helpers + Files Trigger) and land the shared pagination module News (and later S-15) will use.

### Changes Required:

#### 1. Sync with `origin/master`

**File**: git integration (branch `nextcloud-news`)

**Intent**: Ensure `nodes/shared/pollHelpers.ts`, `NextcloudFilesTrigger`, and package registration from S-07 are present before News trigger work.

**Contract**: Merge or rebase onto `origin/master`; resolve conflicts without dropping poll helpers or Files Trigger. `npm run build && npm test` green after sync.

#### 2. Shared pagination helpers

**File**: `nodes/shared/pagination.ts`, `nodes/shared/test/pagination.test.ts` (new)

**Intent**: One suite-facing pagination module so News can ship real cursors and other apps can retrofit later (S-15) without inventing a third pattern.

**Contract**: Export helpers for (a) **client limit** — `applyReturnAllLimit(items, returnAll, limit)` (replacement for ad-hoc `.slice`), and (b) **News-style cursor** — normalize/read `batchSize` + `offset` (item id), build query/body params for `GET /items`, and document that `offset` is the lowest-id cursor from the previous page (per News docs). Unit-test edge cases: `returnAll`, `limit` defaults, `batchSize=-1`, empty pages. Do **not** retrofit Deck/Files/Calendar in this phase.

### Success Criteria:

#### Automated Verification:

- Branch contains `nodes/shared/pollHelpers.ts` and `nodes/NextcloudFilesTrigger/`
- `npm run build` succeeds
- `npm test` passes including new pagination tests
- `npm run lint` passes

#### Manual Verification:

- Confirm merge did not remove Files Trigger from the n8n panel list after a local build (spot-check `package.json` `n8n.nodes`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before Phase 2.

---

## Phase 2: Nextcloud News actions scaffold (Folder + Feed + core Item)

### Overview

Ship the actions node shell, REST helper, Folder/Feed CRUD, Item mark ops (single + bulk), mark feed read, and favicon — excluding the full cursor Get Many (Phase 3).

### Changes Required:

#### 1. News node tree + REST helper

**File**: `nodes/NextcloudNews/GenericFunctions.ts`, `nodes/NextcloudNews/NewsInterface.ts`, `nodes/NextcloudNews/shared/*` (new)

**Intent**: Deck-shaped transport for News API v1.3 with scrub/status helpers.

**Contract**: `newsApiBase(baseUrl)` → `{baseUrl}/index.php/apps/news/api/v1-3`. `newsRequest(context, method, path, options?)` via `httpRequestWithAuthentication(..., 'nextcloudApi', …)` with JSON defaults; support binary responses for favicon. Copy scrub/httpStatus into `shared/` (Deck pattern). Types for Folder, Feed, Item. Loaders `loadFolders` / `loadFeeds` for listSearch. Execute reads `resource` with loop index `i` (not `0`).

#### 2. Resources: folder, feed, item (non-paginated ops)

**File**: `nodes/NextcloudNews/resources/{folder,feed,item}/**`, `listSearch/getFolders.ts`, `listSearch/getFeeds.ts` (new)

**Intent**: Cover the agreed MVP operations with FR-011 resourceLocators.

**Contract**:
- **Folder**: create, getAll (client-limit helper OK), rename/update name, delete
- **Feed**: create, getAll (client-limit OK), delete, move, rename, **mark read** (`POST /feeds/{feedId}/read` + `newestItemId`), **favicon** (`GET /favicon/{md5(url)}` binary)
- **Item**: mark read/unread/star/unstar (single + bulk `itemIds`); Get Many deferred to Phase 3
- Locators: folder + feed (feed list may depend on optional folder filter if useful); empty parent → empty listSearch, not throw
- Unknown resource/operation → throw

#### 3. Node registration + metadata

**File**: `nodes/NextcloudNews/NextcloudNews.node.ts`, `*.node.json`, svg, `package.json`

**Intent**: Panel-visible **Nextcloud News** actions node on shared credential.

**Contract**: `displayName: 'Nextcloud News'`, `name: 'nextcloudNews'`, `credentials: [{ name: 'nextcloudApi', required: true }]`, `usableAsTool: true`, register `dist/nodes/NextcloudNews/NextcloudNews.node.js`. Doc links point at News API v1.3.

#### 4. Helper unit tests

**File**: `nodes/NextcloudNews/test/*.test.ts` (new)

**Intent**: Cover URL builders, id resolvers, favicon hash, scrubbing without live NC.

**Contract**: Vitest under `nodes/NextcloudNews/test/`; mock `httpRequestWithAuthentication` where needed.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds
- `npm run lint` passes
- `npm test` passes
- `package.json` lists the News actions node

#### Manual Verification:

- Local n8n (F-01) shows **Nextcloud News**; credential test still works
- Smoke: create folder, create feed, mark one item read, fetch favicon binary (News app enabled)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Item Get Many with real pagination

### Overview

Wire Item Get Many to News `batchSize`/`offset` through shared pagination helpers (no fetch-all-then-slice for items).

### Changes Required:

#### 1. Item Get Many operation

**File**: `nodes/NextcloudNews/resources/item/getAll.ts`, `resources/item/index.ts` (update)

**Intent**: Authors page articles the way News intends, with type/id/getRead/oldestFirst filters.

**Contract**: UI exposes `batchSize`, `offset` (item id cursor), `type` (Feed/Folder/Starred/All), `id`, `getRead`, `oldestFirst`, plus optional convenience presets that only set defaults. Calls `GET /items` with those params via shared helpers. Returns one n8n item per article (full JSON). Does **not** silently download the entire history when the author asked for a page.

#### 2. Pagination tests for News items

**File**: `nodes/NextcloudNews/test/` + `nodes/shared/test/pagination.test.ts` (extend)

**Intent**: Lock cursor param building and empty/partial page behavior.

**Contract**: Unit tests for query construction and multi-page “next offset = min id” guidance from News docs.

### Success Criteria:

#### Automated Verification:

- `npm test` covers item pagination helpers
- `npm run build` + `npm run lint` pass

#### Manual Verification:

- Get Many with small `batchSize` returns that many items; next call with `offset` continues older items
- Unread-only (`getRead=false`) works for type All

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Nextcloud News Trigger

### Overview

Add polling trigger for **new** articles (ID window), optional folder/feed scope, Unread only checkbox, full article JSON output, soft-fail with one notice item.

### Changes Required:

#### 1. Trigger node shell + registration

**File**: `nodes/NextcloudNewsTrigger/**`, `package.json` (update)

**Intent**: Separate panel trigger following Files Trigger conventions.

**Contract**: `polling: true`, `group: ['trigger']`, `credentials: nextcloudApi`, properties: optional folder locator, optional feed locator, boolean **Unread only** (default true or false — pick default **true** for inbox-style). Register `dist/nodes/NextcloudNewsTrigger/NextcloudNewsTrigger.node.js`. Reuse News listSearch where practical.

#### 2. Poll orchestration

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts` (and small pure helpers as needed)

**Intent**: Detect newly seen article ids and emit full items.

**Contract**:
- Use `GET /items` with scope (`type`/`id` from folder/feed selection; all feeds → `type=3`,`id=0`) and `getRead=false` when Unread only is checked
- Dedupe with `filterIdsInStaticData` on article `id` strings
- First init / scope change: seed processed ids from current listing (or empty window + mark seen), return `null`
- Production: emit only unseen ids as full article JSON (one n8n item each)
- Manual: up to one sample matching filters, else `null`
- Soft-fail + one notice item per Critical Implementation Details; never advance ID window on soft-fail

#### 3. Trigger unit tests

**File**: `nodes/NextcloudNewsTrigger/test/*.test.ts` (new)

**Intent**: Mocked `poll()` covers seed, new ids, unread filter, scope change re-seed, soft-fail notice once, manual sample.

**Contract**: No live Nextcloud; assert static-data transitions and output shapes.

### Success Criteria:

#### Automated Verification:

- `npm test` includes News Trigger poll tests
- `npm run build` + `npm run lint` pass
- Both News nodes listed in `package.json`

#### Manual Verification:

- Activate workflow with News Trigger: no flood on activate; new unread article fires full JSON item
- Toggle Unread only / feed filter; change feed re-seeds without flood
- Force API error after init → one notice item; recovery clears notice behavior on success
- Test step returns a sample or null without killing the schedule

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Docs touch-ups + close-out verification

### Overview

Align node metadata/docs links, update change status notes, and run the full local verification gate.

### Changes Required:

#### 1. Metadata and suite pattern note

**File**: `NextcloudNews*.node.json`, optionally append a short News subsection under the suite polling follow-ups note if present on branch

**Intent**: Point authors at API v1.3; record that News Trigger uses ID-window + unread filter so future apps copy the right pattern.

**Contract**: Doc URLs include https://nextcloud.github.io/news/api/api-v1-3/. Pattern note (if updated) states News is the second shipped poller after Files.

#### 2. Full gate

**File**: n/a (commands)

**Intent**: Prove package health before calling S-06 done.

**Contract**: `npm run build && npm run lint && npm test` green; F-01 link path still works for Calendar/Deck/Files + News actions + both triggers.

### Success Criteria:

#### Automated Verification:

- `npm run build && npm run lint && npm test` all succeed

#### Manual Verification:

- Panel search finds Nextcloud News and Nextcloud News Trigger
- End-to-end smoke: credential → folder/feed/item action → trigger fires on new article
- Confirm secrets scrubbed in a forced error path

**Implementation Note**: After manual confirmation, S-06 can be marked done / archived via normal process; S-14 and S-15 remain proposed.

---

## Testing Strategy

### Unit Tests:

- Shared pagination: client-limit + cursor param builders
- News URL builders, favicon md5, resolve locators
- scrubSecrets / httpStatus (copied helpers)
- Trigger: seed, ID window, unread filter, scope re-seed, soft-fail notice once, manual sample

### Integration Tests:

- None in CI against live Nextcloud (package convention)

### Manual Testing Steps:

1. Merge/build; confirm Files Trigger still present
2. News actions: folder CRUD, feed create/move/rename/delete, mark feed read, favicon binary, item mark single+bulk
3. Item Get Many: page with `batchSize`/`offset`
4. Trigger: activate, publish new feed item, verify one full JSON fire; unread filter; error notice once
5. Multi-item execute with expression-driven `resource` uses index `i`

## Performance Considerations

- Item Get Many must not default to unbounded history pulls; authors choose `batchSize` (document that `-1` means all — dangerous on large instances).
- Trigger listing should use a bounded `batchSize` for candidate fetch (plan default: reasonable page or unread-focused query) so polls stay cheap; ID window caps via `filterIdsInStaticData` max size.

## Migration Notes

- New nodes only — no breaking changes to existing suite nodes.
- Requires News app enabled on the target Nextcloud.
- Prefer app passwords for Basic Auth.

## References

- Research: `context/changes/nextcloud-news/research.md`
- News API v1.3: https://nextcloud.github.io/news/api/api-v1-3/
- News API v2 (deferred S-14): https://nextcloud.github.io/news/api/api-v2/
- Deck template: `nodes/NextcloudDeck/`
- Polling pattern: `nodes/NextcloudFilesTrigger/`, `nodes/shared/pollHelpers.ts`, `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md` (on master)
- Roadmap: S-06, S-14, S-15

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Merge master + shared pagination foundations

#### Automated

- [x] 1.1 Branch contains `nodes/shared/pollHelpers.ts` and `nodes/NextcloudFilesTrigger/` — d85bb7f
- [x] 1.2 `npm run build` succeeds — d85bb7f
- [x] 1.3 `npm test` passes including new pagination tests — d85bb7f
- [x] 1.4 `npm run lint` passes — d85bb7f

#### Manual

- [x] 1.5 Confirm merge did not remove Files Trigger from the n8n panel list after a local build (spot-check `package.json` `n8n.nodes`) — d85bb7f

### Phase 2: Nextcloud News actions scaffold (Folder + Feed + core Item)

#### Automated

- [x] 2.1 `npm run build` succeeds — 9d327cc
- [x] 2.2 `npm run lint` passes — 9d327cc
- [x] 2.3 `npm test` passes — 9d327cc
- [x] 2.4 `package.json` lists the News actions node — 9d327cc

#### Manual

- [x] 2.5 Local n8n (F-01) shows **Nextcloud News**; credential test still works — 9d327cc
- [x] 2.6 Smoke: create folder, create feed, mark one item read, fetch favicon binary (News app enabled) — 9d327cc

### Phase 3: Item Get Many with real pagination

#### Automated

- [x] 3.1 `npm test` covers item pagination helpers
- [x] 3.2 `npm run build` + `npm run lint` pass

#### Manual

- [x] 3.3 Get Many with small `batchSize` returns that many items; next call with `offset` continues older items
- [x] 3.4 Unread-only (`getRead=false`) works for type All

### Phase 4: Nextcloud News Trigger

#### Automated

- [ ] 4.1 `npm test` includes News Trigger poll tests
- [ ] 4.2 `npm run build` + `npm run lint` pass
- [ ] 4.3 Both News nodes listed in `package.json`

#### Manual

- [ ] 4.4 Activate workflow with News Trigger: no flood on activate; new unread article fires full JSON item
- [ ] 4.5 Toggle Unread only / feed filter; change feed re-seeds without flood
- [ ] 4.6 Force API error after init → one notice item; recovery clears notice behavior on success
- [ ] 4.7 Test step returns a sample or null without killing the schedule

### Phase 5: Docs touch-ups + close-out verification

#### Automated

- [ ] 5.1 `npm run build && npm run lint && npm test` all succeed

#### Manual

- [ ] 5.2 Panel search finds Nextcloud News and Nextcloud News Trigger
- [ ] 5.3 End-to-end smoke: credential → folder/feed/item action → trigger fires on new article
- [ ] 5.4 Confirm secrets scrubbed in a forced error path
