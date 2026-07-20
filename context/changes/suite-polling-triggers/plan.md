# Suite Polling Triggers Implementation Plan

## Overview

Deliver FR-009 / roadmap S-07 by shipping the first suite **polling trigger**: `NextcloudFilesTrigger`. It watches a chosen folder (Depth 1) for file/folder **created** and **updated** events, using n8n’s shared poll runtime (`polling: true` + `poll()`) and the existing Files WebDAV listing. Calendar/Deck/Talk triggers are out of scope for this change but the pattern is documented so they can follow. A tiny shared `pollHelpers` module seeds cursors / optional ID-window dedupe for reuse.

## Current State Analysis

The package has three **action** nodes (Calendar, Deck, Files) and one credential (`nextcloudApi`). There are **zero** Trigger nodes and no `poll()` implementations. n8n owns scheduling when a node sets `polling: true` and implements `poll()`; each app owns change detection and static-data cursors (see research).

Files already exposes enough for a Drive-style folder poll:

- `loadDirectoryListing` → PROPFIND Depth 1 with `getetag` / `getlastmodified` / `resourcetype` (`nodes/NextcloudFiles/GenericFunctions.ts`)
- Parsed `DirectoryEntry`: `path`, `etag`, `lastModified`, `isFolder`, etc. (`FilesInterface.ts`)
- Path `resourceLocator` + `getFolders` listSearch for FR-011-style folder pick
- Listed directory self-entry is skipped in the parser — children only

Calendar cannot yet poll reliably (filters `DTSTART` not `LAST-MODIFIED`; S-08 PROPFIND truncation). Deck listings have no modification timestamps in this package. Talk/News nodes do not exist. Research and questioning therefore chose **Files first**, one solid trigger, then expand.

### Key Discoveries:

- Poll contract: `polling: true`, `async poll(this: IPollFunctions)`, return items or `null`; do not author `pollTimes`; do not call `__emit` — research.md
- Google Drive Trigger UX to mirror: `folderToWatch`, `event` ∈ file/folder created/updated, notice that subfolders are not watched — `GoogleDriveTrigger.node.ts`
- Soft-fail with existing cursor (Outlook) + manual sample-1 / throw-if-empty (Google) — planned convention for the suite
- Suite registers nodes only via `package.json` → `n8n.nodes` dist paths — no package `index.ts`
- Vitest co-located under `nodes/**/test/**/*.test.ts`; Files parse tests use multistatus fixtures; Deck mocks `httpRequestWithAuthentication`

## Desired End State

A workflow author can:

1. Add **Nextcloud Files Trigger** as the workflow start node
2. Attach the shared `nextcloudApi` credential
3. Pick a folder (`folderToWatch` list or manual path)
4. Choose which events to emit: file/folder created and/or updated (at least the planned set)
5. Activate the workflow (or Test step) and receive items when immediate children of that folder appear or change — without flooding history on first activation
6. See Poll Times (injected by n8n) and rely on ≥1 minute platform minimum

Automated: `npm run build && npm run lint && npm test` pass. Manual: trigger appears in the panel, Test step returns a sample, activated poll does not re-emit unchanged listings.

### Key Discoveries:

- No delta/sync-token API in this package — poll = snapshot diff on `path` + `etag`/`lastModified`
- Depth 1 only — document clearly; recursive watch is a later change if needed
- Cross-import from `nodes/NextcloudFiles/` for WebDAV; tiny new `nodes/shared/pollHelpers.ts` for cursor/dedupe only

## What We're NOT Doing

- Calendar / Deck / Talk / News polling triggers (follow-up changes; pattern noted in Phase 6)
- Webhook triggers (FR-010)
- Recursive / subfolder watching
- Delete / share-change / activity-stream events
- OneDrive-style WebDAV sync-collection / delta
- CalDAV REPORT / S-08 work inside this change
- OAuth2 credential work (S-02)
- Live Nextcloud CI integration tests
- Refactoring Files action helpers into a package-wide WebDAV layer
- npm publish / README rewrite beyond a one-line “What’s Included” if needed for the new trigger name

## Implementation Approach

Build bottom-up: pure helpers → classification → thin trigger shell + registration → wire `poll()` to Files listing → mocked `poll()` tests → short follow-on pattern note.

Classification model (Drive-like, no delete):

- Maintain per-node static data: `lastTimeChecked` (ISO/ms) + snapshot map `path → { etag?, lastModified?, isFolder }`
- First production/activation poll with empty snapshot: seed cursor to now, store snapshot, return `null` (no history flood)
- Later polls: load Depth-1 children of `folderToWatch`; for each entry not in snapshot → **created**; for each entry in snapshot whose etag/lastModified changed → **updated**; filter by selected `event` options and `isFolder`
- Soft-fail: if listing throws and a cursor/snapshot already exists, scrub/log and return `null` without advancing
- Manual (`getMode() === 'manual'`): ignore since-filter / treat as sample — return up to 1 matching child (or any child if needed); throw if directory empty / nothing to show

## Critical Implementation Details

- **Timing & lifecycle** — First successful production poll must seed snapshot + `lastTimeChecked` and return `null`. Only later polls may emit. Static data persists when n8n `__emit`s; returning `null` after seed still needs the snapshot stored — use the same pattern as Drive/Gmail: mutate `getWorkflowStaticData('node')` in place; if the platform only persists on emit, ensure the seed path still works on activation (activation runs a testing poll — prefer seed-without-emit, matching Google Calendar/Drive “set lastTimeChecked then filter”).
- **State sequencing** — Prefer **etag** for update detection when present; fall back to `lastModified` string compare. Paths are keys after `normalizeFilesPath`.
- **User experience** — Show a notice that only **direct children** of the watched folder are considered (Depth 1), matching Google Drive’s subfolder notice.

## Phase 1: Shared poll helpers

### Overview

Add a tiny package-level helper module for cursor seeding and optional ID-window dedupe, with unit tests — no Trigger node yet.

### Changes Required:

#### 1. pollHelpers module

**File**: `nodes/shared/pollHelpers.ts` (new)

**Intent**: Centralize the few static-data utilities every suite trigger will need so Files (and later Calendar/Deck) do not copy-paste cursor boilerplate.

**Contract**: Export small pure helpers, e.g. `seedLastTimeChecked(staticData, now)`, `getLastTimeChecked(staticData)`, and an optional bounded ID-window helper (Salesforce-inspired: track recent ids, cap size). No HTTP, no n8n context types beyond plain objects / `IDataObject`-compatible records. Keep the surface minimal.

#### 2. Unit tests for pollHelpers

**File**: `nodes/shared/test/pollHelpers.test.ts` (new)

**Intent**: Lock cursor seed and dedupe behavior before any node depends on them.

**Contract**: Vitest cases for seed-on-empty, preserve-existing-cursor, and ID-window add/cap/filter. No network.

### Success Criteria:

#### Automated Verification:

- `nodes/shared/pollHelpers.ts` and `nodes/shared/test/pollHelpers.test.ts` exist
- `npm test` passes (helpers suite green)
- `npm run lint` passes for new files

#### Manual Verification:

- None for this phase

**Implementation Note**: After automated verification passes, proceed to Phase 2 (no manual gate).

---

## Phase 2: Listing snapshot + create/update classification

### Overview

Pure functions that diff a previous directory snapshot against a new `DirectoryEntry[]` and produce classified change records — unit-tested with fixtures.

### Changes Required:

#### 1. Snapshot / classify module

**File**: `nodes/NextcloudFilesTrigger/classifyDirectoryChanges.ts` (new) — or `nodes/NextcloudFilesTrigger/GenericFunctions.ts` if preferred for suite consistency

**Intent**: Isolate create-vs-update logic from the poll shell so it can be tested without `IPollFunctions`.

**Contract**: Types for snapshot map and change record `{ event: 'fileCreated' | 'fileUpdated' | 'folderCreated' | 'folderUpdated'; entry: DirectoryEntry }`. Function `classifyDirectoryChanges(previous, current) → changes[]` using path keys, etag/lastModified compare, and `isFolder` to pick event names. Pure: no I/O.

#### 2. Classification unit tests

**File**: `nodes/NextcloudFilesTrigger/test/classifyDirectoryChanges.test.ts` (new)

**Intent**: Cover empty→create, etag change→update, unchanged→omit, folder vs file event names, mixed batches.

**Contract**: Table-driven fixtures of `DirectoryEntry` objects (reuse field shapes from `FilesInterface.ts`). Optionally reuse multistatus XML → parse via Files `parseDirectoryListingFromMultistatus` for one integration-style unit test.

### Success Criteria:

#### Automated Verification:

- Classification module + tests exist
- `npm test` covers create, update, no-op, folder/file split
- `npm run lint` passes

#### Manual Verification:

- None for this phase

**Implementation Note**: After automated verification passes, proceed to Phase 3.

---

## Phase 3: Trigger node shell + registration

### Overview

Scaffold `NextcloudFilesTrigger` as a registered polling trigger with Drive-like folder-watch parameters. `poll()` may return `null` until Phase 4.

### Changes Required:

#### 1. Trigger node description

**File**: `nodes/NextcloudFilesTrigger/NextcloudFilesTrigger.node.ts` (new), `NextcloudFilesTrigger.node.json` (new), icon (reuse or copy `nextcloudFiles.svg`)

**Intent**: Make the trigger appear in the n8n panel as a start node with Poll Times injected by the loader.

**Contract**:
- `displayName: 'Nextcloud Files Trigger'`, `name: 'nextcloudFilesTrigger'`, `group: ['trigger']`, `inputs: []`, `outputs: [Main]`, `polling: true`, `credentials: [{ name: 'nextcloudApi', required: true }]`
- Properties: `folderToWatch` resourceLocator (folders-only listSearch), `event` multiOptions or options for `fileCreated` / `fileUpdated` / `folderCreated` / `folderUpdated` (default: file created + file updated, or all four — pick one coherent default in implementation)
- Notice: only direct children of the watched folder are detected
- `async poll()` stub returning `null`
- `methods.listSearch` folders-only (thin wrap of Files listSearch / `loadDirectoryListing`)
- `.node.json`: `node: "n8n-nodes-nextcloud.nextcloudFilesTrigger"`, category aligned with Files (`Data & Storage`)

#### 2. Package registration

**File**: `package.json`

**Intent**: Load the trigger alongside action nodes.

**Contract**: Append `"dist/nodes/NextcloudFilesTrigger/NextcloudFilesTrigger.node.js"` to `n8n.nodes`.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds and emits the trigger dist file
- `npm run lint` passes
- `package.json` lists the new dist entry

#### Manual Verification:

- After local community-node link / `n8n-node dev`, **Nextcloud Files Trigger** appears under triggers when searching “nextcloud”
- Node shows Poll Times, credential, folder picker, event options, Depth-1 notice

**Implementation Note**: Pause for manual confirmation that the node appears before Phase 4.

---

## Phase 4: `poll()` wired to Files WebDAV

### Overview

Implement real polling: list watched folder, classify against static-data snapshot, emit filtered events; soft-fail and manual-sample behavior as decided.

### Changes Required:

#### 1. poll() implementation

**File**: `nodes/NextcloudFilesTrigger/NextcloudFilesTrigger.node.ts`

**Intent**: Connect n8n’s poll ticks to Nextcloud Files listing and the Phase 1–2 helpers so workflows start on create/update.

**Contract**:
- Resolve `folderToWatch` via normalized path (same rules as Files `resolvePathFromInput` / `normalizeFilesPath`)
- `getCredentials` + `loadDirectoryListing` from `../NextcloudFiles/GenericFunctions`
- Static data key namespace under `getWorkflowStaticData('node')`: `lastTimeChecked`, `snapshot` (path → meta)
- First poll (empty snapshot): seed helpers + write snapshot + return `null`
- Subsequent: `classifyDirectoryChanges` → filter by selected events → `return [this.helpers.returnJsonArray(items)]` or `null`
- Output JSON: at least `event`, `path`, `basename`, `isFolder`, `etag`, `lastModified` (plus useful Fields entry fields)
- `getMode() === 'manual'`: return one sample item; throw scrubbed error if none
- On listing error with existing snapshot: scrub secrets, soft-fail return `null` (do not advance snapshot)
- On listing error with no snapshot (activation): rethrow so activation can fail loudly

#### 2. Error scrubbing reuse

**File**: import from `nodes/NextcloudFiles/shared/scrubSecrets.ts` (and `httpStatus` if throwing `NodeApiError`)

**Intent**: Keep secret hygiene consistent with action nodes (NFR).

**Contract**: No `appPassword` in thrown messages or soft-fail logs.

### Success Criteria:

#### Automated Verification:

- `npm run build` succeeds
- `npm run lint` passes
- Typecheck clean for trigger + imports from Files

#### Manual Verification:

- Test step on a non-empty folder returns one sample item
- Activate workflow: first period does not flood old files; creating/updating a direct child emits once
- Transient error (e.g. wrong folder after snapshot exists) does not wipe cursor / spam executions

**Implementation Note**: Pause for manual confirmation before Phase 5 (or run Phase 5 tests first if preferred — tests may be written TDD-style alongside Phase 4; Progress still tracks them under Phase 5).

---

## Phase 5: End-to-end unit tests for `poll()`

### Overview

Vitest coverage for `poll()` behavior with mocked WebDAV / `IPollFunctions`, matching suite mock style.

### Changes Required:

#### 1. poll() unit tests

**File**: `nodes/NextcloudFilesTrigger/test/NextcloudFilesTrigger.poll.test.ts` (new)

**Intent**: Prove empty, create, update, soft-fail, and manual paths without a live Nextcloud.

**Contract**: Mock `helpers.httpRequestWithAuthentication` (or stub `loadDirectoryListing` if injected) and a minimal `IPollFunctions` (`getMode`, `getNodeParameter`, `getWorkflowStaticData`, `helpers.returnJsonArray`, credentials). Cases:
- empty snapshot → `null` + snapshot seeded
- new child → created event item(s)
- etag change → updated event
- unchanged listing → `null`
- error with snapshot → `null` (soft-fail)
- manual + empty → throws
- manual + data → one item
- event filter excludes non-selected types

### Success Criteria:

#### Automated Verification:

- New poll tests pass under `npm test`
- Full `npm run build && npm run lint && npm test` green

#### Manual Verification:

- None beyond spot-check if desired

**Implementation Note**: After automated verification, proceed to Phase 6.

---

## Phase 6: Suite pattern note

### Overview

Document how the next app triggers should copy this shape, and record explicit follow-ups (Calendar after S-08, Deck timestamps, Talk).

### Changes Required:

#### 1. Change notes / follow-up doc

**File**: `context/changes/suite-polling-triggers/change.md` (`## Notes`) and/or `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md` (new)

**Intent**: Capture the suite pattern so Calendar/Deck/Talk work does not re-litigate packaging or poll conventions.

**Contract**: Short checklist: one Trigger class per app; `polling: true`; reuse `nodes/shared/pollHelpers.ts`; soft-fail + manual sample convention; Files-specific: Depth-1 snapshot diff; Calendar blocked on S-08 + LAST-MODIFIED/sync; Deck needs timestamps or id-list dedupe; Talk later (Gmail-like). No code changes required in this phase beyond notes.

#### 2. Optional README one-liner

**File**: `README.md` (only if it already lists included nodes)

**Intent**: Mention Files Trigger exists so local testers find it.

**Contract**: Single bullet under What’s Included — skip if README has no such list.

### Success Criteria:

#### Automated Verification:

- Follow-up note file exists (or `## Notes` in `change.md` populated with the checklist)

#### Manual Verification:

- Notes are accurate vs the shipped Files Trigger (event names, Depth-1, soft-fail)

**Implementation Note**: Final phase — after notes land, mark change ready for impl-review / archive when S-07 Files slice is accepted.

---

## Testing Strategy

### Unit Tests:

- `pollHelpers`: seed, preserve, ID-window cap
- `classifyDirectoryChanges`: create / update / no-op / folder vs file
- `poll()`: seed, emit, filter, soft-fail, manual throw/sample

### Integration Tests:

- None in CI (no live Nextcloud). Manual Phase 3–4 verification is the integration proof.

### Manual Testing Steps:

1. Link package / `n8n-node dev`; confirm **Nextcloud Files Trigger** in panel
2. Workflow: Trigger → (optional Set/NoOp); credential + folder + events
3. Test step on folder with at least one child → one sample item
4. Activate; wait a poll; confirm no flood
5. Upload or overwrite a file in that folder (not a nested subfolder) → workflow runs once with correct `event`
6. Confirm nested subfolder changes do **not** fire (Depth-1 notice)
7. Confirm errors do not leak `appPassword`

## Performance Considerations

- One PROPFIND Depth 1 per poll tick per active trigger — acceptable at ≥1 minute intervals
- Snapshot size = number of direct children; fine for typical folders; very large directories may need a later limit/pagination story (out of scope)
- Do not recurse; do not call `collectPathEntriesRecursive` as currently hardcoded from `/`

## Migration Notes

- No data migration. Existing workflows unchanged.
- New node type only; no breaking changes to `nextcloudFiles` action node.

## Open Risks & Assumptions

- Platform persists static data on emit; seed-on-first-poll must still leave a durable snapshot after activation — verify during Phase 4 manual test; if seed does not persist without emit, adjust to match a known Drive/Gmail pattern that works on this n8n version.
- `lastModified` string compare may be fragile across locales; prefer etag when present.
- Soft-fail can hide persistent misconfiguration — acceptable per planning decision; document in node description if useful.

## References

- Related research: `context/changes/suite-polling-triggers/research.md`
- Roadmap S-07 / FR-009: `context/foundation/roadmap.md`, `context/foundation/prd.md`
- Files listing: `nodes/NextcloudFiles/GenericFunctions.ts` (`loadDirectoryListing`, `parseDirectoryListingFromMultistatus`)
- Files path locator: `nodes/NextcloudFiles/shared/descriptions.ts`
- Reference triggers (n8n monorepo): Google Drive Trigger, Microsoft Outlook Trigger (soft-fail), Gmail Trigger (manual/dedupe)
- Prior Files plan (action node, explicitly excluded triggers): `context/archive/2026-07-18-nextcloud-files-drive/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared poll helpers

#### Automated

- [x] 1.1 `nodes/shared/pollHelpers.ts` and `nodes/shared/test/pollHelpers.test.ts` exist — fba4026
- [x] 1.2 `npm test` passes (helpers suite green) — fba4026
- [x] 1.3 `npm run lint` passes for new files — fba4026

### Phase 2: Listing snapshot + create/update classification

#### Automated

- [x] 2.1 Classification module + tests exist — 66e2d5a
- [x] 2.2 `npm test` covers create, update, no-op, folder/file split — 66e2d5a
- [x] 2.3 `npm run lint` passes — 66e2d5a

### Phase 3: Trigger node shell + registration

#### Automated

- [x] 3.1 `npm run build` succeeds and emits the trigger dist file — 1012134
- [x] 3.2 `npm run lint` passes — 1012134
- [x] 3.3 `package.json` lists the new dist entry — 1012134

#### Manual

- [ ] 3.4 After local community-node link / `n8n-node dev`, Nextcloud Files Trigger appears under triggers when searching “nextcloud”
- [ ] 3.5 Node shows Poll Times, credential, folder picker, event options, Depth-1 notice

### Phase 4: `poll()` wired to Files WebDAV

#### Automated

- [ ] 4.1 `npm run build` succeeds
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 Typecheck clean for trigger + imports from Files

#### Manual

- [ ] 4.4 Test step on a non-empty folder returns one sample item
- [ ] 4.5 Activate workflow: first period does not flood old files; creating/updating a direct child emits once
- [ ] 4.6 Transient error (e.g. wrong folder after snapshot exists) does not wipe cursor / spam executions

### Phase 5: End-to-end unit tests for `poll()`

#### Automated

- [ ] 5.1 New poll tests pass under `npm test`
- [ ] 5.2 Full `npm run build && npm run lint && npm test` green

### Phase 6: Suite pattern note

#### Automated

- [ ] 6.1 Follow-up note file exists (or `## Notes` in `change.md` populated with the checklist)

#### Manual

- [ ] 6.2 Notes are accurate vs the shipped Files Trigger (event names, Depth-1, soft-fail)
