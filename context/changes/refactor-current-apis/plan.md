# Suite API client + repository refactor — Implementation Plan

## Overview

Migrate **NextcloudNews**, **NextcloudFiles**, and **NextcloudCalendar** from ad-hoc `GenericFunctions` HTTP to the **NextcloudDeck reference pattern**: per-node API documentation, typed client (`*.client.ts`), Zod-validated repositories returning `Maybe<T>`, and thin resource handlers. Extract shared `Maybe` helpers to `nodes/shared/`. **NextcloudDeck is complete** — use it as reference only. **Phase 4** migrates trigger nodes to parent repositories.

Each application phase follows the same four sub-steps (invoke the corresponding Cursor skills):

1. **Documentation** — `/api-documentation` → `nodes/<Node>/context/api/documentation/`
2. **Client** — `/api-client` → `<name>.client.ts`
3. **Repositories** — `/api-repositories` → `repositories/*.repository.ts`
4. **Refactor** — wire resources + slim `GenericFunctions.ts` to n8n glue only

## Current State Analysis

| Node | HTTP layer today | Resources | Docs folder | Tests |
| --- | --- | --- | --- | --- |
| **NextcloudDeck** | `deck.client.ts` + repositories | board, stack, card | ✅ `context/api/documentation/` | client + repo tests |
| **NextcloudNews** | `newsRequest()` in `GenericFunctions.ts` (~349 LOC) | folder, feed, item | ❌ | `GenericFunctions.test.ts`, `itemGetAll.test.ts` |
| **NextcloudFiles** | `nextcloudRequest()` + `ocsRequest()` (~795 LOC) | file, folder, share | ❌ | `GenericFunctions.test.ts`, `ocs.test.ts` |
| **NextcloudCalendar** | `nextcloudRequest()` CalDAV (~447 LOC) + `ics/` domain | event | ❌ | ICS tests, `getAll.test.ts`, `GenericFunctions.test.ts` |
| **NextcloudNewsTrigger** | imports `NextcloudNews/GenericFunctions` | poll only | — | `NextcloudNewsTrigger.poll.test.ts` |
| **NextcloudFilesTrigger** | imports `NextcloudFiles/GenericFunctions` | poll only | — | poll + classify tests |

**Deck reference pattern** (resources → repositories → client):

```1:7:nodes/NextcloudDeck/resources/board/getAll.ts
import { createDeckClient, filterActiveBoards } from '../../GenericFunctions';
import { getBoards } from '../../repositories/DeckBoard.repository';
import { unwrapResult } from '../../shared/apiResponseHelpers';
// ...
unwrapResult(await getBoards(await createDeckClient(context)))
```

### Key Discoveries:

- News is closest to Deck (JSON REST at `/index.php/apps/news/api/v1-3`) — lowest-risk first migration.
- Files spans **two servers**: WebDAV (`/remote.php/dav/files/…`) and OCS shares (`/ocs/v2.php/apps/files_sharing/api/v1/…`); one client class can target both via absolute paths (same pattern as Deck REST vs OCS note in `deck.client.ts`).
- Calendar CalDAV returns **XML multistatus** and **ICS bodies**; repositories own HTTP + XML parsing; **`nodes/NextcloudCalendar/ics/` stays the ICS domain layer** (build, patch, parse, serialize) — do not move ICS logic into the client or repositories.
- Trigger nodes are thin consumers of parent-node listing APIs — Phase 4 rewires them after action nodes expose repositories.

## Desired End State

- Every suite action node has `nodes/<Node>/context/api/documentation/` (README + openapi.md or spec), `<node>.client.ts`, `repositories/<Entity>.repository.ts`, and resources that call repositories via `unwrapResult(await create*Client(context))`.
- `GenericFunctions.ts` per node retains **n8n glue only**: `create*Client`, listSearch loaders, ID/path resolvers, payload builders — **no raw HTTP**.
- `nodes/shared/apiResult.ts` (name TBD) holds `Maybe<T>`, `parseWith`, `parseEmpty`, `unwrapResult`; Deck imports from shared module.
- Trigger nodes use parent repositories/clients, not legacy `newsRequest` / `nextcloudRequest`.
- All existing tests pass; new client + repository unit tests mirror Deck coverage.

### Verification

- `npm run lint:safety` && `npm run test` && `npm run build` pass after each phase.
- Manual: run representative operations per node via local n8n link (F-01 path).

## What We're NOT Doing

- Re-refactoring **NextcloudDeck** (reference only; Phase 0 updates imports to shared helpers).
- Migrating **NextcloudTalk**, **Tasks**, or **Contacts** (not shipped yet).
- Changing node UI property descriptions or credential types.
- Moving ICS date/duration logic into repositories (Calendar `ics/` boundary is fixed).
- News API v2 migration (roadmap S-14).
- Suite-wide pagination envelope (S-08) or partial-update helpers (S-09) — though this refactor unblocks them.

## Implementation Approach

**Order:** News → Files → Calendar → Triggers (REST confidence first; CalDAV last).

**Per-app sub-steps:** documentation skill → client skill → repositories skill → resource refactor. Complete and verify each app before starting the next.

**Shared extraction (Phase 0)** precedes all apps so repositories consistently import from `nodes/shared/`.

## Critical Implementation Details

### Calendar ICS boundary (review checkpoint)

Repositories and the calendar client handle **CalDAV transport only**: PROPFIND/REPORT/PUT/DELETE, multistatus XML parsing, href extraction, raw ICS fetch/store. **All RFC 5545 semantics** (exclusive DTEND, all-day vs timed, patch merge, timezone rebinding) remain in `nodes/NextcloudCalendar/ics/`. Event repository functions accept/return parsed ICS strings or href metadata — they call `ics/build`, `ics/patchEvent`, `ics/parse` at the repository↔resource boundary, not inside the HTTP client.

**When reviewing Phase 3 implementation:** confirm no ICS parsing crept into `calendar.client.ts` and no CalDAV XML parsing crept into `ics/`.

---

## Phase 0: Shared API result helpers

### Overview

Extract Deck's `Maybe` / parse / unwrap utilities to `nodes/shared/` and repoint Deck.

### Changes Required:

#### 1. Shared module

**File**: `nodes/shared/apiResult.ts` (new)

**Intent**: Single suite-wide `Maybe<T>`, `parseWith`, `parseEmpty`, `unwrapResult` — copied from Deck's `apiResponseHelpers.ts` with generic naming (not Deck-specific).

**Contract**: Export types and functions matching current Deck behavior; `deckEmptySchema` becomes a generic empty-response schema.

#### 2. Deck repoint

**File**: `nodes/NextcloudDeck/shared/apiResponseHelpers.ts`

**Intent**: Re-export from `nodes/shared/apiResult.ts` (or delete and update imports) so Deck stays green without duplicating logic.

**Contract**: All Deck repository and resource imports resolve to shared module.

#### 3. Shared tests

**File**: `nodes/shared/test/apiResult.test.ts` (new)

**Intent**: Unit tests for `parseWith` success/failure paths and `unwrapResult` throw behavior.

**Contract**: Cover at least schema mismatch and failed client result passthrough.

### Success Criteria:

#### Automated Verification:

- `npm run lint:safety`
- `npm run test`
- `npm run build`

#### Manual Verification:

- Deck node operations unchanged in local n8n smoke test (board getAll, card create)

**Implementation Note**: Pause for manual confirmation before Phase 1.

---

## Phase 1: NextcloudNews

### Overview

Full docs → client → repositories → resource refactor for News API v1.3.

### Changes Required:

#### 1.1 API documentation

**Skill**: `/api-documentation NextcloudNews`

**File**: `nodes/NextcloudNews/context/api/documentation/` (new tree)

**Intent**: Gather News API v1.3 docs (official repo / readthedocs); verbatim sources + `openapi.md` + README per skill conventions.

**Contract**: Document folders, feeds, items endpoints used by existing resources (`/folders`, `/feeds`, `/feeds/{id}/move`, item bulk actions, favicon binary route).

#### 1.2 News client

**Skill**: `/api-client` (input: News openapi.md)

**File**: `nodes/NextcloudNews/news.client.ts` (new)

**Intent**: Typed HTTP client for News REST base `/index.php/apps/news/api/v1-3`; `NewsClient.fromN8nContext(context)` using `httpRequestWithAuthentication('nextcloudApi')`; GET/POST/PUT/DELETE returning `Maybe`.

**Contract**: Support JSON default and optional non-JSON encoding for favicon route (arraybuffer) via request options — mirror current `newsRequest` encoding flag.

#### 1.3 News repositories

**Skill**: `/api-repositories`

**Files**:

- `nodes/NextcloudNews/repositories/NewsFolder.repository.ts`
- `nodes/NextcloudNews/repositories/NewsFeed.repository.ts`
- `nodes/NextcloudNews/repositories/NewsItem.repository.ts`

**Intent**: One repository per entity; Zod schemas from live response shapes in `NewsInterface.ts` / existing unwrap helpers; functions `(client: NewsClient, options) => Promise<Maybe<T>>`.

**Contract**: Cover all operations today routed through `newsRequest`: folder CRUD, feed CRUD/move/rename/markRead/favicon, item getAll/markAction/markMultiple.

#### 1.4 Refactor resources + slim GenericFunctions

**Files**: `nodes/NextcloudNews/resources/**/*.ts`, `nodes/NextcloudNews/GenericFunctions.ts`

**Intent**: Replace `newsRequest` + `unwrapFolders/Feeds/Items` calls with repository + `unwrapResult`; keep `getCredentials`, `createNewsClient`, `loadFolders`, `loadFeeds`, `resolve*Id`, `parseItemIds` in GenericFunctions.

**Contract**: Resource output shape unchanged (`entityJson` helpers still used); delete `newsRequest` and unwrap helpers once all resources migrated.

#### 1.5 News tests

**Files**: `nodes/NextcloudNews/test/news.client.test.ts`, `nodes/NextcloudNews/test/News*.repository.test.ts` (new); update `GenericFunctions.test.ts`

**Intent**: Client error formatting + repository schema validation tests mirroring Deck.

### Success Criteria:

#### Automated Verification:

- `npm run lint:safety`
- `npm run test`
- `npm run build`

#### Manual Verification:

- Folder create/list, feed create/getAll, item getAll + mark read/star in local n8n

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: NextcloudFiles

### Overview

Document WebDAV + OCS sharing; build client; repositories for file, folder, share; refactor resources.

### Changes Required:

#### 2.1 API documentation

**Skill**: `/api-documentation NextcloudFiles`

**File**: `nodes/NextcloudFiles/context/api/documentation/` (new tree)

**Intent**: Document WebDAV files API (PROPFIND, PUT, GET, DELETE, MOVE, COPY, MKCOL) and OCS files_sharing v1 endpoints used by share resources.

**Contract**: Two server bases in Servers table; entity schemas for `DirectoryEntry`, `ParsedShare`; document OCS envelope where applicable.

#### 2.2 Files client

**Skill**: `/api-client`

**File**: `nodes/NextcloudFiles/files.client.ts` (new)

**Intent**: Client supporting WebDAV methods (including PROPFIND, MOVE, COPY, MKCOL) and OCS JSON routes; binary body support for upload/download; `FilesClient.fromN8nContext(context)`.

**Contract**: `#buildUrl` accepts absolute WebDAV URLs and OCS paths; headers for Destination/Overwrite on MOVE/COPY; returns raw string/buffer for XML and binary responses in `Maybe.response`.

#### 2.3 Files repositories

**Skill**: `/api-repositories`

**Files**:

- `nodes/NextcloudFiles/repositories/FilesFolder.repository.ts` — list, create, delete, move, copy (WebDAV)
- `nodes/NextcloudFiles/repositories/FilesFile.repository.ts` — upload, download, delete, move, copy
- `nodes/NextcloudFiles/repositories/FilesShare.repository.ts` — OCS share CRUD

**Intent**: Move XML multistatus parsing (`parseDirectoryListingFromMultistatus`) and OCS share parsing (`parseShare`, `normalizeOcsSharePayload`) into repository layer with Zod validation.

**Contract**: Repositories expose typed `DirectoryEntry[]`, file operation void/results, `ParsedShare` — not raw XML.

#### 2.4 Refactor resources + slim GenericFunctions

**Files**: `nodes/NextcloudFiles/resources/**/*.ts`, `nodes/NextcloudFiles/GenericFunctions.ts`

**Intent**: Resources call repositories; GenericFunctions keeps path helpers (`normalizeFilesPath`, `buildFilesUrl`, `buildDestinationHeader`), credentials, `createFilesClient`, listSearch cache, share permission bitmask builders, password validation orchestration (calling share repository).

**Contract**: Remove `nextcloudRequest`, `ocsRequest`, and response parsers from GenericFunctions once migrated.

#### 2.5 Files tests

**Files**: client + repository tests; migrate relevant cases from `GenericFunctions.test.ts` and `ocs.test.ts`

### Success Criteria:

#### Automated Verification:

- `npm run lint:safety`
- `npm run test`
- `npm run build`

#### Manual Verification:

- File upload/download, folder list/create, share create/list/update/delete in local n8n

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: NextcloudCalendar

### Overview

CalDAV documentation, client, Calendar + Event repositories (HTTP/XML only), resource refactor. **ICS boundary review required.**

### Changes Required:

#### 3.1 API documentation

**Skill**: `/api-documentation NextcloudCalendar`

**File**: `nodes/NextcloudCalendar/context/api/documentation/` (new tree)

**Intent**: Document CalDAV calendar-home, calendar collection, event resource paths; PROPFIND, REPORT calendar-query, PUT, DELETE; Sabre multistatus shapes.

**Contract**: Separate **Transport** (CalDAV/XML) from **Payload** (ICS) sections in openapi.md — explicit pointer that ICS semantics live in `ics/`.

#### 3.2 Calendar client

**Skill**: `/api-client`

**File**: `nodes/NextcloudCalendar/calendar.client.ts` (new)

**Intent**: CalDAV HTTP client: PROPFIND, REPORT (XML body), PUT (ICS body), DELETE, GET; `CalendarClient.fromN8nContext(context)`.

**Contract**: Returns raw XML string or ICS text in `Maybe.response` — **no ICS parsing in client**; Content-Type headers for `text/calendar` and `application/xml`.

#### 3.3 Calendar repositories

**Skill**: `/api-repositories`

**Files**:

- `nodes/NextcloudCalendar/repositories/CalendarCollection.repository.ts` — list calendars (PROPFIND on calendar-home)
- `nodes/NextcloudCalendar/repositories/CalendarEvent.repository.ts` — get, getAll, create, update, delete events

**Intent**: Repositories parse multistatus XML (move `parseCalendarsFromXml`, `parseEventHrefAndIcsFromMultistatus`, etc. from GenericFunctions); Event repository **calls `ics/` modules** for create/update payload assembly and response parsing — not inline RFC 5545 logic.

**Contract**:

- `getEvent` → returns parsed event fields via `parseIcsEventVerbose` (import from `ics/`)
- `createEvent` / `updateEvent` → accept structured patch; repository invokes `buildICalendarPayload` / `patchEventCalendar`
- `getAllEvents` → returns href + optional raw ICS + dtStart ms for filtering (preserve current getAll filter behavior)

#### 3.4 Refactor resources + slim GenericFunctions

**Files**: `nodes/NextcloudCalendar/resources/event/*.ts`, `nodes/NextcloudCalendar/GenericFunctions.ts`

**Intent**: Event resources call event repository; GenericFunctions keeps `createCalendarClient`, `loadCalendars`, calendar URL resolvers, date filter helpers (`nodeDateToFilterMs`), credential helpers — **not** `nextcloudRequest`.

**Contract**: `ics/` directory untouched except import path adjustments if needed.

#### 3.5 Calendar tests

**Files**: client + repository tests; keep existing `ics.*.test.ts` unchanged; update `getAll.test.ts` / `GenericFunctions.test.ts` for repository mocks

### Success Criteria:

#### Automated Verification:

- `npm run lint:safety`
- `npm run test`
- `npm run build`

#### Manual Verification:

- Event create, get, getAll (with date filters), update (partial fields + all-day), delete in local n8n
- **Review checkpoint:** verify ICS boundary — client has zero ICS imports; `ics/` has zero `httpRequestWithAuthentication` calls

**Implementation Note**: Pause for manual confirmation (including ICS boundary review) before Phase 4.

---

## Phase 4: Trigger nodes

### Overview

Rewire polling triggers to use Phase 1–3 repositories instead of legacy GenericFunctions HTTP.

### Changes Required:

#### 4.1 NextcloudNewsTrigger

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts`

**Intent**: Replace `newsRequest` / `unwrapItems` with `NewsItem.repository` list functions + `createNewsClient`; keep poll orchestration in `nodes/shared/pollOrchestration.ts`.

**Contract**: Pagination (`buildNewsItemsQueryParams`, offset) preserved; poll test mocks updated to repository layer.

#### 4.2 NextcloudFilesTrigger

**File**: `nodes/NextcloudFilesTrigger/pollDirectory.ts`

**Intent**: Replace `loadDirectoryListing` GenericFunctions call with `FilesFolder.repository` list via `createFilesClient`.

**Contract**: Snapshot/classify behavior unchanged; poll test mocks updated.

#### 4.3 Trigger tests

**Files**: `nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`, `nodes/NextcloudFilesTrigger/test/NextcloudFilesTrigger.poll.test.ts`

**Intent**: Update mocks from HTTP helpers to repository functions.

### Success Criteria:

#### Automated Verification:

- `npm run lint:safety`
- `npm run test`
- `npm run build`

#### Manual Verification:

- News trigger poll (manual activation sample + steady poll) in local n8n
- Files trigger poll on watched folder in local n8n

**Implementation Note**: Final manual sign-off completes the change.

---

## Testing Strategy

### Unit Tests:

- Shared `apiResult` parse/unwrap edge cases
- Per-node `*.client.test.ts` — error formatting, auth context factory
- Per-entity `*.repository.test.ts` — schema validation, empty responses, OCS/XML parse fixtures
- Preserve all existing ICS tests without modification

### Integration Tests:

- Existing resource-level tests (`itemGetAll.test.ts`, poll tests) updated to mock repositories not HTTP

### Manual Testing Steps:

1. Link package locally (`npm run dev` / F-01 path)
2. Per phase: run one create, one read/list, one update, one delete for the migrated node
3. Phase 4: activate each trigger, confirm poll output shape unchanged
4. Phase 3: explicitly review Calendar ICS boundary per Critical Implementation Details

## Performance Considerations

No intentional behavior change — same request counts per operation. Repository Zod parse adds negligible overhead vs current manual parsing. Avoid double-fetch on Calendar update (GET→patch→PUT stays one GET in event repository update helper).

## Migration Notes

- **Incremental by app**: each phase is shippable; do not start Calendar before News + Files are green.
- **Deck**: import-only change in Phase 0; no feature work.
- **Breaking changes**: none expected for workflow JSON or output shapes — internal refactor only.
- **Rollback**: revert per-phase commits if manual verification fails.

## References

- Roadmap: `context/foundation/roadmap.md` (F-04)
- Deck reference: `nodes/NextcloudDeck/deck.client.ts`, `nodes/NextcloudDeck/repositories/`
- Skills: `.cursor/skills/api-documentation/SKILL.md`, `api-client/SKILL.md`, `api-repositories/SKILL.md`
- Shared context: `nodes/shared/requestContext.ts`, `nodes/shared/parse.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 0: Shared API result helpers

#### Automated

- [x] 0.1 `npm run lint:safety` — abe27fd
- [x] 0.2 `npm run test` — abe27fd
- [x] 0.3 `npm run build` — abe27fd

#### Manual

- [x] 0.4 Deck smoke test in local n8n (board getAll, card create) — abe27fd

### Phase 1: NextcloudNews

#### Automated

- [ ] 1.1 `npm run lint:safety`
- [ ] 1.2 `npm run test`
- [ ] 1.3 `npm run build`

#### Manual

- [ ] 1.4 News folder/feed/item operations in local n8n

### Phase 2: NextcloudFiles

#### Automated

- [ ] 2.1 `npm run lint:safety`
- [ ] 2.2 `npm run test`
- [ ] 2.3 `npm run build`

#### Manual

- [ ] 2.4 Files file/folder/share operations in local n8n

### Phase 3: NextcloudCalendar

#### Automated

- [ ] 3.1 `npm run lint:safety`
- [ ] 3.2 `npm run test`
- [ ] 3.3 `npm run build`

#### Manual

- [ ] 3.4 Calendar event CRUD + filters in local n8n
- [ ] 3.5 ICS boundary review (client vs ics/ separation)

### Phase 4: Trigger nodes

#### Automated

- [ ] 4.1 `npm run lint:safety`
- [ ] 4.2 `npm run test`
- [ ] 4.3 `npm run build`

#### Manual

- [ ] 4.4 News trigger poll in local n8n
- [ ] 4.5 Files trigger poll in local n8n
