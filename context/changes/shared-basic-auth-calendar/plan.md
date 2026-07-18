# Shared Basic Auth + Nextcloud Calendar Implementation Plan

## Overview

Implement roadmap S-01: a shared Nextcloud Basic Auth credential (`nextcloudApi`) and a Nextcloud Calendar node that proves it with full event CRUD, list-or-type calendar pickers, and defensive secret scrubbing — establishing the suite credential contract every later app node will reuse.

## Current State Analysis

`packages/nextcloud/` is still starter-shaped after F-01: Example + GithubIssues registered, identity filled, local link verify documented. No Nextcloud credentials or suite nodes yet.

Calendar prior art already exists outside the active package at `packages/nextcloud backup/calendar/`: `nextcloudApi` (`baseUrl` / `username` / `appPassword`, `/status.php` test), CalDAV event Create/Get/Get Many/Update/Delete, and `resourceLocator` + `listSearch` calendar pickers. That prior art has **no** secret scrubbing on error paths. The zahidcoder frame settled rewrite-on-scaffold + port this prior art (not fork the monolith). Monorepo has no vitest/jest wired yet; backup helper tests use Jest-like globals with no runner.

### Key Discoveries:

- Prior art credential: `packages/nextcloud backup/calendar/credentials/NextcloudApi.credentials.ts` — type name `nextcloudApi`, Basic Auth via `authenticate.type: 'generic'` + `auth.username` / `auth.password` → `appPassword`
- Prior art Calendar: `packages/nextcloud backup/calendar/nodes/NextcloudCalendar/` — programmatic `execute()`, CalDAV `PROPFIND` via typed method extension, `httpRequestWithAuthentication`
- Preferred modular layout in-package: GithubIssues `listSearch/` + `resources/` + `shared/` (CalDAV stays programmatic — no declarative `routing`)
- F-01 gate remains `npm link` into `~/.n8n/custom`; README currently tells users to search for `Example` (must change when canaries die)
- PRD guardrail: no secrets in outputs/errors — prior art does not meet this today

## Desired End State

A workflow author can create one shared Nextcloud Basic Auth credential, attach it to **Nextcloud Calendar**, pick a calendar from a loaded list or type a slug/path, run Create / Get / Get Many / Update / Delete, and get useful event items — with `appPassword` never appearing in node error messages or continue-on-fail error JSON. Package registers only `nextcloudApi` + Nextcloud Calendar; starter canaries are gone. Helper + scrubber unit tests pass via `npm test`. Local F-01 link path still works; panel search target is `Nextcloud Calendar`.

### Key Discoveries:

- Soft phase split: implement credential before Calendar code; **live** credential Test against real Nextcloud waits until after Calendar (Phase 3)
- Canary removal is atomic with Calendar registration (same phase) so the package never ships zero nodes
- Credential field names stay `baseUrl` / `username` / `appPassword` (CalDAV path user id guidance preserved)

## What We're NOT Doing

- OAuth2 credential (S-02)
- Other suite apps (Files, Deck, Talk, News)
- Polling / webhook triggers
- Forking or adopting zahidcoder as foundation
- Fixing prior-art ICS timezone quirks (port behavior as-is)
- Live Nextcloud integration tests in CI
- npm publish / renaming away from existing npm `n8n-nodes-nextcloud` ownership questions
- Full product README rewrite from `README_TEMPLATE.md` (only update verify/canary references needed for this slice)
- Replacing core `nodes-base` Nextcloud

## Implementation Approach

Two ordered deliverables in one change, plus a verification phase:

1. **Credential first** — port `NextcloudApi` into the active package and register it alongside canaries so the shared-auth contract exists before CalDAV work.
2. **Calendar second** — reshape-port Calendar into GithubIssues-style modules, add scrubber + Vitest, then atomically swap `package.json` registrations (Calendar in, canaries out) and fix README panel tips.
3. **Verify** — F-01 link path + real Nextcloud credential Test + Calendar smoke (including FR-011 list and manual picker modes).

Source of truth for CalDAV behavior: `packages/nextcloud backup/calendar/`. Structure target: starter GithubIssues layout patterns under `nodes/NextcloudCalendar/`.

## Critical Implementation Details

- **Timing & lifecycle:** Phase 1 must not remove canaries (package would still need nodes). Phase 2 registration change is atomic: add Calendar node registration and delete Example/GithubIssues (+ their credentials/icons) in the same edit. Live `/status.php` credential Test is deferred to Phase 3 by design — do not block Phase 2 on a reachable Nextcloud.
- **User experience spec:** Calendar field remains `resourceLocator` with `list` (`searchListMethod: 'getCalendars'`) and manual `id` (slug or full `/remote.php/dav/...` path). Drop unused prior-art `loadOptions` twin — listSearch only.
- **Debug & observability:** Secret scrubbing must run on `continueOnFail` error strings and on messages/bodies before `NodeApiError` in Calendar `execute` (and listSearch failures that surface to the UI). Unit-test redaction with fixture secrets; do not rely on live NC for scrub proof.

## Phase 1: Shared Basic Auth credential

### Overview

Add the shared `nextcloudApi` credential to the active package and register it without touching canary nodes or requiring a live Nextcloud.

### Changes Required:

#### 1. Credential type + icon

**File**: `credentials/NextcloudApi.credentials.ts` (new), `credentials/nextcloudApi.svg` (new)

**Intent**: Port the proven Nextcloud Basic Auth credential so all suite nodes can share one `baseUrl` + username + app password contract.

**Contract**: `ICredentialType` with `name = 'nextcloudApi'`, `displayName = 'Nextcloud API'`, properties `baseUrl` / `username` / `appPassword` (`password: true`), username description noting CalDAV path user id (not necessarily email), `authenticate.type: 'generic'` with `auth.username` / `auth.password` → `appPassword`, and declarative `test` → `GET {{$credentials.baseUrl}}/status.php`. Icon co-located as in prior art. Do not rename fields.

#### 2. Register credential (interim)

**File**: `package.json`

**Intent**: Make the credential loadable in n8n while canaries remain the only nodes.

**Contract**: Append `dist/credentials/NextcloudApi.credentials.js` to `n8n.credentials`. Leave `n8n.nodes` unchanged (Example + GithubIssues).

### Success Criteria:

#### Automated Verification:

- `credentials/NextcloudApi.credentials.ts` and `credentials/nextcloudApi.svg` exist
- `package.json` `n8n.credentials` includes `NextcloudApi` and still lists GithubIssues credentials
- `n8n.nodes` still lists Example and GithubIssues only
- `npm run build` succeeds
- `npm run lint` succeeds

#### Manual Verification:

- Credential type appears selectable in n8n after local load (optional in Phase 1; live Test against Nextcloud is deferred to Phase 3)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Calendar node + quality gates + canary cutover

### Overview

Port Calendar into modular form with secret scrubbing and unit tests, then atomically register Calendar and remove starter canaries so the package is Nextcloud-only.

### Changes Required:

#### 1. Calendar node tree (modular port)

**File**: `nodes/NextcloudCalendar/` (new tree)

**Intent**: Deliver full event CRUD + FR-011 calendar pickers using prior-art CalDAV behavior and GithubIssues-style file layout.

**Contract**: Programmatic `NextcloudCalendar.node.ts` with `credentials: [{ name: 'nextcloudApi', required: true }]`, resource `event`, operations `create` / `get` / `getAll` / `update` / `delete`. Split descriptions under `resources/event/` + `shared/descriptions.ts` (calendar `resourceLocator`: list + manual id). `listSearch/getCalendars.ts` only (no unused `loadOptions`). Keep CalDAV helpers in `GenericFunctions.ts` (`PROPFIND` method union, `nextcloudRequest` via `httpRequestWithAuthentication`). Port `EventInterface.ts`, SVG icon, and `NextcloudCalendar.node.json` with `node` string updated for package `n8n-nodes-nextcloud` (not `n8n-nodes-nextcloud-calendar`).

#### 2. Secret scrubber

**File**: `nodes/NextcloudCalendar/shared/scrubSecrets.ts` (new)

**Intent**: Close the PRD guardrail gap prior art never implemented — keep `appPassword` and obvious Basic Auth material out of user-visible errors.

**Contract**: Helper that redacts non-empty secrets (at least `appPassword`, `Authorization: Basic …` blobs, and `username:password` substrings) to a fixed placeholder. Call from Calendar `execute` catch paths (`continueOnFail` and pre-`NodeApiError`) and from listSearch error surfacing if applicable. Prefer scrubbing at the node boundary; optional wrap inside `nextcloudRequest` is fine if it keeps one choke point.

#### 3. Vitest + unit tests

**File**: `package.json`, `vitest.config.ts` (new), `tsconfig.json`, `nodes/NextcloudCalendar/test/GenericFunctions.test.ts`, `nodes/NextcloudCalendar/test/scrubSecrets.test.ts`

**Intent**: Add a package test runner and lock parser/URL helpers plus scrubbing without needing a live Nextcloud in CI.

**Contract**: Add `vitest` as a devDependency and `"test": "vitest run"`. Config: Jest-compatible globals, include `nodes/**/test/**/*.test.ts`. Exclude `**/*.test.ts` and `nodes/**/test/**` from `tsconfig` emit so tests never land in `dist/`. Port backup `GenericFunctions` assertions; add scrubber tests that fail if fixture secrets survive.

#### 4. Atomic package cutover + README tip

**File**: `package.json`, `README.md`; delete canary paths listed below

**Intent**: Ship a Nextcloud-only registration set and keep F-01 instructions accurate after canaries disappear.

**Contract**: Set `n8n.credentials` to only `dist/credentials/NextcloudApi.credentials.js` and `n8n.nodes` to only `dist/nodes/NextcloudCalendar/NextcloudCalendar.node.js`. Delete:
- `nodes/Example/` (entire)
- `nodes/GithubIssues/` (entire)
- `credentials/GithubIssuesApi.credentials.ts`
- `credentials/GithubIssuesOAuth2Api.credentials.ts`
- `icons/github.svg`, `icons/github.dark.svg`
Update README “What’s Included” / Explore / local-verify panel search tip from `Example` / GitHub Issues to **Nextcloud Calendar** (and mention the shared Nextcloud API credential). Do not full-rewrite from `README_TEMPLATE.md`.

### Success Criteria:

#### Automated Verification:

- Calendar tree exists with listSearch + event resources + scrubber
- Starter Example/GithubIssues source files and GithubIssues credentials/icons are gone
- `package.json` registers only `NextcloudApi` + `NextcloudCalendar`
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (GenericFunctions + scrubSecrets)
- README local-verify guidance searches for `Nextcloud Calendar`, not `Example`

#### Manual Verification:

- (Optional mid-phase) Package loads in n8n after rebuild/link with Calendar visible — full smoke deferred to Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: North-star local verification

### Overview

Prove US-01 / FR-001 / FR-011 on a real Nextcloud via the F-01 link path: shared credential Test, then Calendar operations with list and manual resource pickers, confirming useful outputs and no secret leakage in errors.

### Changes Required:

#### 1. Manual verification only

**File**: none required (docs already updated in Phase 2)

**Intent**: Close the north star with human-run evidence against a real instance; no further code unless verification finds defects (fix forward into this phase if scrubbing/ops fail).

**Contract**: Follow README F-01 gate (`build` → `npm link` → link `n8n-nodes-nextcloud` in `~/.n8n/custom` → `n8n start`). Create `Nextcloud API` credential; run credential Test against real Nextcloud. Exercise Calendar Create, Get, Get Many, Update, Delete. Confirm calendar picker **From List** and **By ID** (slug and/or full path). Confirm a forced failure path does not echo `appPassword` in the UI error.

### Success Criteria:

#### Automated Verification:

- Re-run `npm run build`, `npm run lint`, and `npm test` after any Phase 3 fixes

#### Manual Verification:

- After F-01 link path, node panel search for `Nextcloud Calendar` finds the node from this package
- Credential Test against real Nextcloud succeeds for valid `baseUrl` / `username` / `appPassword`
- Create / Get / Get Many / Update / Delete produce useful workflow items (no secrets in outputs)
- Calendar resourceLocator works in list mode and manual id mode
- Deliberate bad request / continue-on-fail path does not show `appPassword` in the error message

**Implementation Note**: This phase is the human gate for S-01. Pause until manual confirmation succeeds before treating the change as implemented.

---

## Testing Strategy

### Unit Tests:

- Port prior-art `GenericFunctions` coverage (URL builders, calendar XML parse, ICS helpers, resolve slug vs path)
- Scrubber: fixture `appPassword`, Basic header, and `user:pass` substrings are fully redacted; clean strings pass through unchanged

### Integration Tests:

- None in CI (no live Nextcloud). Manual Phase 3 is the integration proof.

### Manual Testing Steps:

1. `npm run build && npm run lint && npm test` in `packages/nextcloud`
2. F-01 link path; search panel for `Nextcloud Calendar`
3. Create shared Nextcloud API credential; click Test
4. Get Many with calendar From List; repeat with By ID slug
5. Create → Get → Update → Delete one event; inspect items for useful fields and absence of secrets
6. Trigger an error (bad event id) with continue-on-fail and confirm redaction

## Performance Considerations

CalDAV Get Many uses PROPFIND Depth 1 and client-side date filters from prior art — acceptable for MVP volumes. No new caching layer. Do not add runtime dependencies for XML/ICS parsing (keep regex helpers).

## Migration Notes

- Existing local links to `n8n-nodes-nextcloud` keep working (package name unchanged); after Phase 2, restart n8n / rebuild so canaries disappear and Calendar appears
- No npm publish in this change; if a published zahidcoder `n8n-nodes-nextcloud` exists on npm, ownership/rename remains a later concern (frame already noted)

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD: US-01, FR-001, FR-011 — `context/foundation/prd.md`
- Frame (rewrite, not zahidcoder): `context/changes/zahidcoder-adopt-or-rewrite/frame.md`
- Prior art: `packages/nextcloud backup/calendar/`
- F-01 verify path: `context/changes/local-community-node-verify/plan.md`
- Layout reference: `nodes/GithubIssues/` (until deleted in Phase 2) / `starter/nodes/GithubIssues/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared Basic Auth credential

#### Automated

- [x] 1.1 Credential type and icon exist under `credentials/` — cca67dc
- [x] 1.2 `package.json` registers `NextcloudApi` alongside existing credentials — cca67dc
- [x] 1.3 `n8n.nodes` still lists Example and GithubIssues only — cca67dc
- [x] 1.4 `npm run build` succeeds — cca67dc
- [x] 1.5 `npm run lint` succeeds — cca67dc

#### Manual

- [x] 1.6 Phase 1 pause — human confirms ready for Calendar (live credential Test deferred) — cca67dc

### Phase 2: Calendar node + quality gates + canary cutover

#### Automated

- [x] 2.1 Calendar modular tree exists (listSearch, event resources, GenericFunctions, scrubber) — 54fccbb
- [x] 2.2 Starter Example/GithubIssues sources and GithubIssues credentials/icons removed — 54fccbb
- [x] 2.3 `package.json` registers only `NextcloudApi` + `NextcloudCalendar` — 54fccbb
- [x] 2.4 `npm run build` succeeds — 54fccbb
- [x] 2.5 `npm run lint` succeeds — 54fccbb
- [x] 2.6 `npm test` succeeds (GenericFunctions + scrubSecrets) — 54fccbb
- [x] 2.7 README local-verify panel tip targets `Nextcloud Calendar` — 54fccbb

#### Manual

- [x] 2.8 Phase 2 pause — human confirms cutover ready for north-star smoke — 54fccbb

### Phase 3: North-star local verification

#### Automated

- [x] 3.1 `npm run build`, `npm run lint`, and `npm test` still pass after any Phase 3 fixes

#### Manual

- [x] 3.2 F-01 link path — panel finds `Nextcloud Calendar`
- [x] 3.3 Credential Test succeeds against real Nextcloud
- [x] 3.4 Event Create / Get / Get Many / Update / Delete produce useful items without secrets
- [x] 3.5 Calendar picker works in list and manual id modes
- [x] 3.6 Error path does not expose `appPassword`
