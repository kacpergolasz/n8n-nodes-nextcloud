# Nextcloud Deck (boards/cards) Implementation Plan

## Overview

Implement roadmap S-04 / FR-005: a separate **Nextcloud Deck** suite node that automates Deck **boards** and **cards** (with stacks as a supporting concept for card placement), reusing the existing shared `nextcloudApi` Basic Auth credential and mirroring the Calendar node's modular layout. This is the second suite app after Calendar and the first proof that the shared-credential contract generalizes beyond CalDAV to Nextcloud's JSON/OCS app APIs.

## Current State Analysis

After S-01, `packages/nextcloud/` ships exactly one credential (`nextcloudApi`) and one node (`Nextcloud Calendar`), registered in `package.json` `n8n.credentials` / `n8n.nodes`. The Calendar node established the modular convention every suite node should follow:

- `nodes/NextcloudCalendar/NextcloudCalendar.node.ts` — programmatic `execute()` with a per-item try/catch that scrubs secrets and maps HTTP status.
- `nodes/NextcloudCalendar/GenericFunctions.ts` — `getCredentials`, `nextcloudRequest` (thin wrapper over `httpRequestWithAuthentication.call(context, 'nextcloudApi', …)`), URL builders, response parsers.
- `nodes/NextcloudCalendar/listSearch/getCalendars.ts` — `listSearch` method feeding a `resourceLocator` picker.
- `nodes/NextcloudCalendar/resources/event/index.ts` + `shared/descriptions.ts` — operation/property descriptions split out of the node file.
- `nodes/NextcloudCalendar/shared/scrubSecrets.ts` + `shared/httpStatus.ts` — secret redaction and best-effort status extraction, both unit-tested.
- `vitest.config.mjs` (globals, `include: ['nodes/**/test/**/*.test.ts']`) + `tsconfig.json` excludes tests from `dist`.

The Deck app exposes a **JSON REST API** (not CalDAV) at `{baseUrl}/index.php/apps/deck/api/v1.0`, requiring the header `OCS-APIRequest: true` and `Content-Type: application/json`. Responses are plain JSON objects/arrays. This is materially simpler than Calendar — no XML multistatus, no ICS folding/parsing. The credential, auth transport, scrubbing, and status helpers all carry over unchanged in shape.

### Key Discoveries:

- Deck REST base is `{baseUrl}/index.php/apps/deck/api/v1.0`; every request needs `OCS-APIRequest: true` (Deck rejects requests without it). Auth is the same Basic Auth the credential already provides.
- Boards: `GET /boards` (`?details=true` enriches with stacks/labels/users), `POST /boards` (`title`,`color`), `GET|PUT|DELETE /boards/{boardId}`, `POST /boards/{boardId}/undo_delete`. Board `PUT` expects `title`+`color`(+`archived`).
- Stacks: `GET /boards/{boardId}/stacks` (returns stacks each with a nested `cards[]` array), `POST /boards/{boardId}/stacks` (`title`,`order`), `GET|PUT|DELETE /boards/{boardId}/stacks/{stackId}`.
- Cards: `POST /boards/{boardId}/stacks/{stackId}/cards` (`title`, `type:"plain"`, `order`, optional `description`, `duedate`), `GET|PUT|DELETE /boards/{boardId}/stacks/{stackId}/cards/{cardId}`, `PUT …/cards/{cardId}/reorder` (`order` + target `stackId`) to move a card between stacks.
- **There is no flat "list all cards" endpoint** — cards are nested inside `GET /boards/{boardId}/stacks`. Card "Get Many" must fetch stacks and flatten `cards[]`, optionally filtered by stack.
- Card `PUT` update expects a fairly complete object (`title` required); partial updates risk clobbering — a GET→merge→PUT approach is safest (mirrors S-09 Calendar partial-update reasoning).
- listSearch for stacks is **board-dependent**: it must read the currently selected board parameter from the node context (`this.getNodeParameter`/`this.getCurrentNodeParameter`) before it can list stacks.
- `scrubSecrets.ts` and `httpStatus.ts` live under each node's `shared/` (self-contained node); Deck should carry its own copies to preserve node independence and the established layout.
- Frame (`context/changes/zahidcoder-adopt-or-rewrite/frame.md`) is authoritative: rewrite on the local scaffold + Calendar patterns, treat zahidcoder only as an endpoint cheat-sheet. Confidence HIGH.

## Desired End State

A workflow author can search the n8n panel for **Nextcloud Deck**, attach the same `Nextcloud API` credential used by Calendar, and:

- Run Board operations: Create, Get, Get Many, Update, Delete — picking a board from a loaded list or entering a board id.
- Run Stack operations: Get Many and Create — picking a board, so a workflow can prepare a column before placing cards.
- Run Card operations: Create, Get, Get Many, Update, Delete, and Move — picking a board (and a stack, dependent on the board) from loaded lists or entering ids.

Outputs are useful JSON items (ids, titles, timestamps, etc.); `appPassword`/Basic Auth material never appears in errors or continue-on-fail JSON; the package registers `nextcloudApi` + **both** Calendar and Deck nodes; unit tests cover Deck URL builders + response normalization + scrubbing via `npm test`; the F-01 local link path still works and the panel finds `Nextcloud Deck`.

### Key Discoveries:

- Card create/move/get all require the `boardId` + `stackId` context, so the card resource carries three locators: board (list), stack (list, board-dependent), and a card id field.
- Board and Card Update both use GET→merge→PUT so authors can send only changed fields.
- Deck's `OCS-APIRequest: true` header is the single most common cause of silent failure if omitted — it must be centralized in the Deck request helper.

## What We're NOT Doing

- No OAuth2 credential (S-02) — reuse existing `nextcloudApi` Basic Auth only.
- No other suite apps (Files, Talk, News) and no triggers (polling/webhooks).
- No Deck **label / user / comment / attachment** card operations, no ACL/sharing management, no board import, no sessions API — deferred as a follow-up slice to keep S-04 shippable in the after-hours budget.
- No new credential fields or changes to the Calendar node.
- No forking or adopting zahidcoder as a foundation (endpoint reference only).
- No live Nextcloud integration tests in CI (manual Phase 3 is the real-instance proof).
- No npm publish / package rename.

## Implementation Approach

Build a self-contained `nodes/NextcloudDeck/` tree mirroring `NextcloudCalendar/`, backed by a JSON REST helper (`deckRequest`) that centralizes the Deck base path, the `OCS-APIRequest: true` header, and JSON content type over the shared `httpRequestWithAuthentication('nextcloudApi', …)` transport. Deliver in three phases: (1) scaffold + Board resource + board picker + tests + registration; (2) Stack (minimal) + Card resource incl. Move, with the board-dependent stack picker; (3) manual north-star verification against a real Nextcloud via the F-01 link path. Copy the small `scrubSecrets`/`httpStatus` helpers into Deck's `shared/` to keep the node independent, matching the current per-node structure.

## Critical Implementation Details

- **API contract gotcha:** Every Deck request MUST send `OCS-APIRequest: true` (and `Content-Type: application/json` for bodies). Centralize both in `deckRequest` so no handler can forget them. Base URL is `{baseUrl}/index.php/apps/deck/api/v1.0` (note `index.php`, not `remote.php`).
- **State sequencing (updates):** Board and Card Update perform GET → shallow-merge provided fields over the current entity → PUT the merged object, because Deck's PUT expects a complete object and a bare partial PUT can blank fields or 400 on missing `title`.
- **Card listing:** Card "Get Many" has no dedicated endpoint — fetch `GET /boards/{boardId}/stacks`, flatten each stack's `cards[]` (optionally filtered to one stack), then apply Return All / Limit client-side exactly like Calendar's `getAll`.
- **Dependent picker:** the stack `listSearch` reads the selected board from node parameters before calling `GET /boards/{boardId}/stacks`; if no board is selected it returns an empty result set rather than erroring.

## Phase 1: Deck node scaffold + Board resource

### Overview

Stand up the `NextcloudDeck` node with the JSON REST helper, board CRUD, a board resource picker, secret scrubbing, unit tests, and package registration alongside Calendar — without requiring a live Nextcloud.

### Changes Required:

#### 1. Deck node tree + REST helper

**File**: `nodes/NextcloudDeck/GenericFunctions.ts`, `nodes/NextcloudDeck/DeckInterface.ts` (new)

**Intent**: Provide the Deck request transport and typed shapes all handlers reuse, mirroring Calendar's `GenericFunctions` but for JSON REST.

**Contract**: `getCredentials(context)` returning normalized `{ baseUrl, username, appPassword }` (reuse Calendar's normalize logic). `deckApiBase(baseUrl)` → `{baseUrl}/index.php/apps/deck/api/v1.0`. `deckRequest(context, method, path, body?)` calling `context.helpers.httpRequestWithAuthentication.call(context, 'nextcloudApi', { method, url, body, json: true, headers: { 'OCS-APIRequest': 'true', 'Content-Type': 'application/json' } })`. URL builders: `buildBoardsUrl`, `buildBoardUrl(id)`, `buildStacksUrl(boardId)`, `buildStackUrl(boardId, stackId)`, `buildCardsUrl(boardId, stackId)`, `buildCardUrl(boardId, stackId, cardId)`, `buildCardReorderUrl(boardId, stackId, cardId)`. Loaders `loadBoards(context)` and `loadStacks(context, boardId)` returning `{ name, value }[]`. `DeckInterface.ts` declares `NextcloudCredentialData` (shared shape) plus `DeckBoard`, `DeckStack`, `DeckCard`, and picker option types.

#### 2. Board descriptions + shared locators

**File**: `nodes/NextcloudDeck/resources/board/index.ts`, `nodes/NextcloudDeck/shared/descriptions.ts` (new)

**Intent**: Declare the Board resource operations and the reusable board `resourceLocator` used by board/stack/card resources.

**Contract**: `shared/descriptions.ts` exports `boardSelect` (`resourceLocator`, modes `list` via `searchListMethod: 'getBoards'` + `id` manual). `resources/board/index.ts` exports `boardDescription: INodeProperties[]` with an `operation` field (`create`,`delete`,`get`,`getAll`,`update`) shown for `resource: ['board']`, the board locator for get/update/delete, `title`/`color` for create, optional `title`/`color`/`archived` for update, and `returnAll`/`limit` for getAll (limit default follows Calendar's lint-exception pattern if needed).

#### 3. Board listSearch

**File**: `nodes/NextcloudDeck/listSearch/getBoards.ts` (new)

**Intent**: Feed the board picker from `GET /boards`.

**Contract**: `getBoards(this: ILoadOptionsFunctions)` calls `loadBoards`, maps to `{ name: title, value: String(id) }`, and on error scrubs the message and throws `NodeApiError` (same shape as `getCalendars`).

#### 4. Deck node class

**File**: `nodes/NextcloudDeck/NextcloudDeck.node.ts`, `nodes/NextcloudDeck/NextcloudDeck.node.json`, `nodes/NextcloudDeck/nextcloudDeck.svg` (new)

**Intent**: Wire the Board resource end to end with the shared error/scrub boundary.

**Contract**: `INodeType` `displayName: 'Nextcloud Deck'`, `name: 'nextcloudDeck'`, `icon: 'file:nextcloudDeck.svg'`, `credentials: [{ name: 'nextcloudApi', required: true }]`, `usableAsTool: true`, `methods.listSearch = { getBoards }`. `resource` options start with `board` (stack/card added in Phase 2). `execute()` loops items with a per-item try/catch that resolves the board id from the locator, dispatches board ops via `deckRequest`, pushes useful JSON, and on error uses `getHttpStatusCode` + `scrubErrorMessage` (404 → friendly "Board not found") before `NodeApiError`. `NextcloudDeck.node.json` sets `node: "n8n-nodes-nextcloud.nextcloudDeck"` and Deck doc URLs.

#### 5. Copy scrub + status helpers

**File**: `nodes/NextcloudDeck/shared/scrubSecrets.ts`, `nodes/NextcloudDeck/shared/httpStatus.ts` (new)

**Intent**: Keep the Deck node self-contained with the same redaction/status behavior as Calendar.

**Contract**: Copy Calendar's `scrubSecrets.ts` (`scrubSecrets`, `scrubErrorMessage`, `ScrubSecretsInput`) and `httpStatus.ts` (`getHttpStatusCode`) verbatim.

#### 6. Register Deck node

**File**: `package.json`

**Intent**: Make Deck loadable in n8n next to Calendar.

**Contract**: Append `dist/nodes/NextcloudDeck/NextcloudDeck.node.js` to `n8n.nodes` (Calendar entry stays). `n8n.credentials` unchanged.

#### 7. Deck unit tests

**File**: `nodes/NextcloudDeck/test/GenericFunctions.test.ts`, `nodes/NextcloudDeck/test/scrubSecrets.test.ts` (new)

**Intent**: Lock URL construction and redaction without a live Nextcloud.

**Contract**: Assert every `build*Url` yields the correct `index.php/apps/deck/api/v1.0/...` path (including `undo_delete` / `reorder` tails added in Phase 2 may be deferred), `loadBoards` maps ids to string values, and reuse Calendar's scrub fixtures. Tests live under `nodes/**/test/**` so the existing `vitest.config.mjs` picks them up.

### Success Criteria:

#### Automated Verification:

- `nodes/NextcloudDeck/` tree exists (node, GenericFunctions, DeckInterface, board resource, listSearch/getBoards, shared scrub/status, icon, node.json)
- `package.json` `n8n.nodes` lists both Calendar and Deck; `n8n.credentials` unchanged
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (Deck GenericFunctions + scrubSecrets)

#### Manual Verification:

- After local rebuild/link, `Nextcloud Deck` appears in the node panel and offers Board operations (live calls deferred to Phase 3)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Stack (minimal) + Card resource with placement

### Overview

Add the Stack resource (Get Many + Create) and the full Card resource (Create, Get, Get Many, Update, Delete, Move), plus the board-dependent stack picker — completing boards-and-cards automation.

### Changes Required:

#### 1. Stack descriptions + listSearch

**File**: `nodes/NextcloudDeck/resources/stack/index.ts`, `nodes/NextcloudDeck/listSearch/getStacks.ts`, `nodes/NextcloudDeck/shared/descriptions.ts` (edit)

**Intent**: Provide minimal stack operations for card-placement setup and the dependent stack picker.

**Contract**: `stackDescription` with `operation` (`getAll`,`create`) for `resource: ['stack']`, the board locator, `title`/`order` for create, `returnAll`/`limit` for getAll. `shared/descriptions.ts` gains `stackSelect` (`resourceLocator`, list via `searchListMethod: 'getStacks'` + manual id). `getStacks(this: ILoadOptionsFunctions)` reads the selected board id from node params, returns empty results if none, else calls `loadStacks` and maps `{ name: title, value: String(id) }`; scrubs + throws `NodeApiError` on failure.

#### 2. Card descriptions

**File**: `nodes/NextcloudDeck/resources/card/index.ts` (new)

**Intent**: Declare Card operations and their board/stack/id inputs.

**Contract**: `cardDescription` with `operation` (`create`,`delete`,`get`,`getAll`,`update`,`move`) for `resource: ['card']`. Board locator on all; stack locator on create/get/delete/update/move and as an optional filter on getAll; `cardId` string field for get/delete/update/move. Create/update fields: `title` (required on create), `description`, `dueDate` (dateTime), `type` hidden/default `plain`. Move fields: target stack locator (`toStack`) + `order` number.

#### 3. Card + Stack execute wiring

**File**: `nodes/NextcloudDeck/NextcloudDeck.node.ts` (edit), `nodes/NextcloudDeck/GenericFunctions.ts` (edit)

**Intent**: Dispatch stack/card operations and enable partial updates + card moves.

**Contract**: Add `stack` and `card` to the `resource` options and register `getStacks` in `methods.listSearch`. Stack: `getAll` → `GET /boards/{boardId}/stacks` (flatten to items, client-side Return All/Limit), `create` → `POST /boards/{boardId}/stacks`. Card: `create` → `POST …/stacks/{stackId}/cards` (default `type:'plain'`, map `dueDate`→`duedate` ISO-8601 or null); `get` → `GET …/cards/{cardId}`; `getAll` → `GET /boards/{boardId}/stacks` then flatten `cards[]` (optionally one stack), client-side Return All/Limit; `update` → GET card → merge provided fields → `PUT …/cards/{cardId}`; `delete` → `DELETE …/cards/{cardId}`; `move` → `PUT …/cards/{cardId}/reorder` with `{ order, stackId: <toStack> }`. Add a `mergeDefined(target, patch)` helper in `GenericFunctions.ts` for board/card partial updates.

#### 4. Extend tests

**File**: `nodes/NextcloudDeck/test/GenericFunctions.test.ts` (edit)

**Intent**: Cover card/stack URL tails, card flattening, and merge semantics.

**Contract**: Assert `buildCardReorderUrl` and stack/card URLs; a `flattenCardsFromStacks(stacks, stackFilter?)` helper returns cards in order and respects the filter; `mergeDefined` overlays only defined keys and drops `undefined`.

### Success Criteria:

#### Automated Verification:

- Card and Stack resources exist with descriptions, listSearch/getStacks, and execute handlers
- `methods.listSearch` exposes both `getBoards` and `getStacks`
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (URL builders, card flatten, merge, scrub)

#### Manual Verification:

- (Optional mid-phase) Deck node shows Board/Stack/Card resources and the stack picker populates after a board is chosen — full smoke deferred to Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: North-star local verification

### Overview

Prove S-04 / FR-005 / FR-011 on a real Nextcloud via the F-01 link path: reuse the shared credential, run board/stack/card operations with list and manual pickers, confirm useful outputs and no secret leakage.

### Changes Required:

#### 1. Manual verification only

**File**: none required (fix-forward into this phase only if verification finds defects)

**Intent**: Close the north star with human-run evidence against a real instance.

**Contract**: Follow the README F-01 gate (`build` → `npm link` → link `n8n-nodes-nextcloud` in `~/.n8n/custom` → `n8n start`). Attach the existing `Nextcloud API` credential to a **Nextcloud Deck** node. Exercise Board Create/Get/Get Many/Update/Delete; Stack Get Many/Create; Card Create/Get/Get Many/Update/Delete/Move. Confirm board picker **From List** and **By ID**, and the stack picker populating after a board is selected. Confirm a forced failure path (bad id / continue-on-fail) does not echo `appPassword` in the UI error.

### Success Criteria:

#### Automated Verification:

- Re-run `npm run build`, `npm run lint`, and `npm test` after any Phase 3 fixes

#### Manual Verification:

- After F-01 link path, panel search for `Nextcloud Deck` finds the node from this package
- Shared `Nextcloud API` credential (same as Calendar) authorizes Deck calls
- Board Create / Get / Get Many / Update / Delete produce useful items (no secrets)
- Stack Get Many / Create work; Card Create / Get / Get Many / Update / Delete / Move work
- Board picker works in list and manual id modes; stack picker populates after board selection
- Deliberate error path does not expose `appPassword` in the message

**Implementation Note**: This phase is the human gate for S-04. Pause until manual confirmation succeeds before treating the change as implemented.

---

## Testing Strategy

### Unit Tests:

- URL builders produce correct `index.php/apps/deck/api/v1.0/...` paths, including `undo_delete` and `reorder` tails
- `loadBoards`/`loadStacks` map api ids to string picker values
- `flattenCardsFromStacks` returns cards across stacks in order and honors an optional stack filter
- `mergeDefined` overlays only defined keys (partial update safety)
- Scrubber: fixture `appPassword`, Basic header, and `user:pass` substrings fully redacted; clean strings unchanged (reuse Calendar fixtures)

### Integration Tests:

- None in CI (no live Nextcloud). Manual Phase 3 is the integration proof.

### Manual Testing Steps:

1. `npm run build && npm run lint && npm test` in `packages/nextcloud`
2. F-01 link path; search panel for `Nextcloud Deck`
3. Attach existing `Nextcloud API` credential; run Board Get Many From List, then By ID
4. Create board → create stack → create card in that stack → Get card → Update card (partial) → Move card to another stack → Delete card
5. Inspect items for useful fields and absence of secrets
6. Trigger an error (bad card id) with continue-on-fail and confirm redaction

## Performance Considerations

Deck responses are small JSON payloads; Card Get Many fetches board stacks (with nested cards) in one request and flattens/limits client-side — acceptable for MVP volumes. No caching layer and no new runtime dependencies (JSON only; no XML/ICS parsing needed).

## Migration Notes

- Package name unchanged; after Phase 1 registration, restart n8n / rebuild so the Deck node appears alongside Calendar.
- No credential migration — Deck reuses `nextcloudApi` exactly as Calendar does.
- No npm publish in this change.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD FR-005 (+ FR-011 pickers, guardrails): `context/foundation/prd.md`
- Frame (rewrite, zahidcoder = endpoint reference only): `context/changes/zahidcoder-adopt-or-rewrite/frame.md`
- S-01 pattern to mirror: `context/archive/2026-07-18-shared-basic-auth-calendar/plan.md`
- Calendar node (layout source of truth): `nodes/NextcloudCalendar/`
- Shared credential: `credentials/NextcloudApi.credentials.ts`
- Deck REST API: https://deck.readthedocs.io/en/latest/API/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Deck node scaffold + Board resource

#### Automated

- [x] 1.1 `nodes/NextcloudDeck/` tree exists (node, GenericFunctions, DeckInterface, board resource, listSearch/getBoards, shared scrub/status, icon, node.json) — 7dae236
- [x] 1.2 `package.json` `n8n.nodes` lists both Calendar and Deck; `n8n.credentials` unchanged — 7dae236
- [x] 1.3 `npm run build` succeeds — 7dae236
- [x] 1.4 `npm run lint` succeeds — 7dae236
- [x] 1.5 `npm test` succeeds (Deck GenericFunctions + scrubSecrets) — 7dae236

#### Manual

- [x] 1.6 Phase 1 pause — human confirms Deck node appears with Board ops (live calls deferred) — 7dae236

### Phase 2: Stack (minimal) + Card resource with placement

#### Automated

- [x] 2.1 Card and Stack resources exist with descriptions, listSearch/getStacks, and execute handlers — 50cd438
- [x] 2.2 `methods.listSearch` exposes both `getBoards` and `getStacks` — 50cd438
- [x] 2.3 `npm run build` succeeds — 50cd438
- [x] 2.4 `npm run lint` succeeds — 50cd438
- [x] 2.5 `npm test` succeeds (URL builders, card flatten, merge, scrub) — 50cd438

#### Manual

- [x] 2.6 Phase 2 pause — human confirms resources and dependent stack picker before smoke — 50cd438

### Phase 3: North-star local verification

#### Automated

- [x] 3.1 `npm run build`, `npm run lint`, and `npm test` still pass after any Phase 3 fixes

#### Manual

- [ ] 3.2 F-01 link path — panel finds `Nextcloud Deck`
- [ ] 3.3 Shared `Nextcloud API` credential authorizes Deck calls
- [ ] 3.4 Board Create / Get / Get Many / Update / Delete produce useful items without secrets
- [ ] 3.5 Stack Get Many / Create and Card Create / Get / Get Many / Update / Delete / Move all work
- [ ] 3.6 Board picker works in list and manual id modes; stack picker populates after board selection
- [ ] 3.7 Error path does not expose `appPassword`
