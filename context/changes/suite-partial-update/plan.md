# Suite Partial Update Implementation Plan

## Overview

Make Nextcloud suite **Update** operations safe and partial: Deck cards use a board-style writable whitelist; Calendar events use a Calendar-owned bidirectional ICS translator (GET → patch → PUT) with Update Fields UX (including all-day, timezone, and SEQUENCE bumps); Files share Update UI aligns to the same Update Fields collection pattern while keeping sparse PUT. Establish a durable **n8n-cli live verification** tradition under `test/n8n-cli/<app>/`. Document the suite Update convention for future apps. Deck **Move** stays out of scope.

## Current State Analysis

- **Calendar** (`nodes/NextcloudCalendar/resources/event/update.ts`): Rebuilds a minimal VEVENT via `buildICalendarPayload` and PUTs with **no GET**. Required UI forces `summary` / `start` / `end`. Clobbers ATTENDEE, RRULE, VALARM, VTIMEZONE/TZID, all-day `VALUE=DATE`, real ICS UID, SEQUENCE, X-*, etc. `parseIcsEventVerbose` is a lossy Get projection (strips VALARM, omits UID) — unfit as a merge source. Raw ICS is already fetched on Get (`Accept: text/calendar`) but discarded after parse.
- **Deck card** (`nodes/NextcloudDeck/resources/card/update.ts`): `mergeDefined(fullGet, patch)` on Zod `.passthrough()` entities — nested `labels` / `assignedUsers` / etc. round-trip into PUT. Board Update already safe via `buildBoardUpdatePayload` (`title` / `color` / `archived` only). F2 deferred this whitelist to S-09.
- **Deck Move**: Still uses `mergeDefined` in `moveCard`, but **explicitly out of scope** for this change (Move is not Update).
- **Files share Update**: Sparse PUT golden path (`buildShareUpdateBody` + `fieldsToUpdate`) already correct; UI is `multiOptions` “Fields to Update” plus gated siblings — inconsistent with Google-style **Update Fields** collection.
- **News**: Single-purpose mutation endpoints — no multi-field Update work.
- **Talk / Tasks / Contacts**: Not implemented — convention stubs only.
- **Dependencies**: No ICS library in package.json; community packaging prefers no new runtime deps. Hand-rolled AST matches existing Calendar parse style.
- **Verification today**: Vitest unit tests only under `nodes/*/test/`. No n8n-cli live workflows in-repo.

## Desired End State

- Deck card Update PUTs only whitelisted scalars (from current + patch); nested/read-only GET fields never enter the body.
- Calendar Update: GET raw ICS → AST → apply only selected Update Fields → bump SEQUENCE when meaning changes → refresh DTSTAMP → keep UID from ICS → serialize → PUT; non-whitelisted structure preserved.
- Calendar Create uses the same serializer (no always-empty DESCRIPTION/LOCATION clobber unless set).
- Files share Update UI is an Update Fields collection; sparse PUT behavior unchanged.
- `test/n8n-cli/{deck,calendar,files}/` holds workflow JSON + run instructions: `@n8n/cli` for create/update/get + execution inspect; **start** runs via Webhook + curl (Manual Execute in UI as fallback). Local n8n with the community node linked.
- A short foundation note records the suite Update contract for future apps.

### Key Discoveries:

- Board whitelist pattern to mirror: `buildBoardUpdatePayload` in `nodes/NextcloudDeck/GenericFunctions.ts` (~397–408) and board Update resource (~27–43).
- Files sparse builder can stay; only UI→`fieldsToUpdate` mapping changes (`buildShareUpdateBody` ~496–534).
- Get already retrieves raw ICS (`resources/event/get.ts`); Update should reuse that fetch shape, not verbose JSON.
- n8n first-party Google Calendar Event Update uses optional **Update Fields** collection — UX target for Calendar and Files.
- Research open question on surgical ICS overlay is **superseded**: this plan uses a preserve-unknown translator class.

## What We're NOT Doing

- Deck **Move** / `moveCard` payload changes (leave as-is; residual `mergeDefined` risk noted below).
- Adding Deck card UI for `archived` / `done` / labels / assignees (labels/assignees remain dedicated endpoints).
- If-Match / etag concurrency for CalDAV.
- Shared `nodes/shared/ics/` package (Calendar-owned only; relocate later if Tasks CalDAV needs it).
- New npm ICS dependencies (`ics`, `ts-ics`, `ical.js`, etc.).
- Inventing Talk / Tasks / Contacts field whitelists or node stubs.
- News multi-field Update.
- Migrating saved production workflows automatically (param-shape breaks for Files/Calendar are accepted for this pre-1.0 package).

## Implementation Approach

Two API shapes, one UX language:

1. **Full-object PUT** (Deck cards, CalDAV event bodies) → GET current → **whitelist** writable fields → PUT. Never `mergeDefined(fullGet, patch)`.
2. **Sparse PUT** (Files share OCS) → Update Fields collection → body with only selected keys (existing builder).

Calendar special case: whitelist merge operates on an **ICS AST**, not JSON. Translator lives under `nodes/NextcloudCalendar/ics/`.

Live verification becomes a suite tradition: per-app folders under `test/n8n-cli/`. **Hybrid run model** — `@n8n/cli` owns workflow CRUD and execution inspect; CLI has no execute/run command, so workflows use a **Webhook** trigger and are started with `curl` (document Manual Execute in the editor as fallback).

## Critical Implementation Details

**UID vs filename:** Calendar Update must keep the `UID` property from the GET ICS. The CalDAV URL/`eventId` is the filename stem and may differ from `UID:` — do not force `eventId` into `UID` on write.

**SEQUENCE:** Treat missing SEQUENCE as `0`. Increment when any applied whitelist field actually changes after normalize (summary, description, start, end, location, all-day ↔ timed, timezone/TZID). No-op Updates (no fields or equal values) must not bump. Always refresh `DTSTAMP`.

**All-day / TZ:** Emit `VALUE=DATE` for all-day; preserve or set `TZID` for timed events per Update Fields. Prefer preserving existing `VTIMEZONE` components when TZID unchanged; changing timezone may leave orphan VTIMEZONE until a later slice — document as known limitation if not solved in-phase.

**n8n-cli tradition (hybrid):** Workflows are artifacts under `test/n8n-cli/<app>/`; they are not Vitest cases. `@n8n/cli` (`N8N_URL` / `N8N_API_KEY` or `n8n-cli config`) is used for `workflow create|update|get|activate` and `execution list|get` — **not** to start runs (no execute command in `@n8n/cli` 0.11.x). Live workflows must include a **Webhook** trigger; README documents `curl` to the webhook URL after activate, then `execution get` to assert success. Manual Execute in the n8n editor is an allowed fallback when debugging. Never commit webhook auth secrets or API keys.

---

## Phase 1: n8n-cli Live Verification Tradition

### Overview

Create the durable layout and docs so later phases drop app-specific workflows into known folders and verify against a local n8n instance via `@n8n/cli`.

### Changes Required:

#### 1. Scaffold per-app live test tree

**File**: `test/n8n-cli/README.md`

**Intent**: Define the suite hybrid tradition — prerequisites (local n8n running, community node linked/built, API key), config via env or `n8n-cli config`, prefer `--format=json`, CLI vs curl responsibilities, and Webhook-based run steps.

**Contract**: Document explicitly:
- CLI: `n8n-cli` / `npx @n8n/cli` for `workflow create|update|get|activate` and `execution list|get` (no execute/run — do not claim otherwise).
- Start: each live workflow JSON uses a **Webhook** trigger; after `workflow activate`, start with `curl` to the webhook URL; then `execution list|get --format=json` to verify.
- Fallback: Manual Execute in the editor.
- Layout: each app owns `test/n8n-cli/<app>/` with workflow JSON + short `README.md` of create → activate → curl → inspect steps.
- Credentials: never committed; reference existing Nextcloud credential on the instance by name/id; webhook auth via env/local config only.

#### 2. Empty app folders with placeholders

**File**: `test/n8n-cli/deck/.gitkeep` (and `calendar/`, `files/`)

**Intent**: Reserve per-app directories so Phase 2+ can add workflows without inventing structure.

**Contract**: Three directories: `deck/`, `calendar/`, `files/`. Optional one-line README stubs pointing at the parent tradition README until real workflows land.

### Success Criteria:

#### Automated Verification:

- Paths exist: `test/n8n-cli/README.md`, `test/n8n-cli/{deck,calendar,files}/`
- README documents hybrid model: CLI create/activate/inspect, Webhook + curl to start, no CLI execute claim

#### Manual Verification:

- From a machine with local n8n + API key configured, `n8n-cli workflow list --format=json` succeeds (sanity of the tradition, not a product assert)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Deck Card Whitelist

### Overview

Replace card Update’s `mergeDefined(fullGet, patch)` with `buildCardUpdatePayload` mirroring board. Move untouched. Add unit tests and the first Deck n8n-cli live workflow.

### Changes Required:

#### 1. Card update payload builder

**File**: `nodes/NextcloudDeck/GenericFunctions.ts`

**Intent**: Add `CardUpdatePatch` + `buildCardUpdatePayload(current, patch)` that emits only writable scalars needed for Deck card PUT, taking unchanged values from `current` when the patch omits them.

**Contract**: Whitelist keys: `title`, `description`, `duedate`, `type`, `order` (and only those for Update). Exclude `id`, `stackId` (Update preserves stack via URL path from `findCardOnBoard`), `labels`, `assignedUsers`, attachments, timestamps, soft-delete, nested objects. `title` required by API — use `patch.title?.trim() || current.title`. Clear due date: `duedate: null`. Default missing `type`/`order` from current (e.g. `type` → `'plain'`, `order` → `0` if absent — match board’s `archived ?? false` style). Rewrite the `.passthrough()` comment: passthrough remains for Get output, not PUT round-trip. Do **not** change `moveCard`.

#### 2. Wire card Update

**File**: `nodes/NextcloudDeck/resources/card/update.ts`

**Intent**: Build the same sparse UI patch as today; call `buildCardUpdatePayload` instead of `mergeDefined`.

**Contract**: UI behavior unchanged (empty title/description = keep; `clearDueDate` → null). PUT body is builder output only.

#### 3. Optional dead UI cleanup

**File**: `nodes/NextcloudDeck/resources/card/index.ts`

**Intent**: Stop showing the hidden `type` param on Update if it is still listed but unused (F1).

**Contract**: `type` `displayOptions` limited to create (and move if applicable) — not update.

#### 4. Unit tests

**File**: `nodes/NextcloudDeck/test/GenericFunctions.test.ts`

**Intent**: Mirror the board whitelist test for cards.

**Contract**: Assert payload contains only whitelist keys; fake `labels`/`assignedUsers` on `current` do not appear; empty patch keeps currents; partial title/description/duedate (incl. null) overlays correctly.

#### 5. Live Deck verification

**File**: `test/n8n-cli/deck/`

**Intent**: Prove against local n8n that card Update changes selected fields without dropping labels/assignees visible on a subsequent Get.

**Contract**: At least one **Webhook-triggered** workflow JSON (e.g. get card → update title/description → get card) plus `README.md` with hybrid steps: `workflow create` → `activate` → `curl` webhook → `execution get`. Preconditions: Deck board/card with labels exist on the target Nextcloud (document how to pick IDs via node params or pinned data).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (Deck GenericFunctions card payload cases)
- Lint passes: `npm run lint`
- `test/n8n-cli/deck/` contains workflow artifact(s) + README run steps

#### Manual Verification:

- Hybrid: create/activate Deck workflow via n8n-cli, start via webhook curl, assert success via `execution get`
- Updated card retains labels/assignees; only intended fields change
- Deck Move still works as before (smoke; no code change expected)

---

## Phase 3: Calendar ICS Translator

### Overview

Introduce a Calendar-owned bidirectional ICS AST (parse ↔ serialize) with preserve-unknown. Migrate Create to the serializer. Prove round-trip in unit tests and an n8n-cli Calendar fidelity workflow (create/get) before partial Update.

### Changes Required:

#### 1. ICS module layout

**File**: `nodes/NextcloudCalendar/ics/` (new)

**Intent**: Hand-rolled translator — no new npm deps — matching existing unfold/escape helpers.

**Contract**: Suggested files: `types.ts` (ordered components/properties), `parse.ts` (string → AST), `serialize.ts` (AST → folded ICS), `dates.ts` (DATE / DATE-TIME / TZID helpers; reuse or move primitives from `GenericFunctions`), thin re-exports from `GenericFunctions` for HTTP-facing callers. Preserve unknown properties, `X-*`, nested `VALARM`, sibling `VTIMEZONE`, RRULE/EXDATE/RDATE, ATTENDEE/ORGANIZER, multi-property order as far as practical. First-VEVENT targeting is enough for Update patching in Phase 4; parser should not destroy other components.

#### 2. Verbose projection + Create migration

**File**: `nodes/NextcloudCalendar/GenericFunctions.ts`, `resources/event/create.ts`

**Intent**: Keep Get JSON via projection from AST (or wrap existing verbose parser). Create builds a minimal AST and serializes — stop emitting empty DESCRIPTION/LOCATION unless the user set them. Add optional Create UI `location` (type already has `location?: string`; Create UI lacks it today) so Create and Update share the same writable location path.

**Contract**: Public Create behavior: required summary/start/end unchanged; optional description + location. Generated UID on create remains. `buildICalendarPayload` either becomes a thin facade over the serializer or is removed after call sites migrate (Update still Phase 4).

#### 3. Unit round-trip tests

**File**: `nodes/NextcloudCalendar/test/` (e.g. `ics.roundtrip.test.ts`)

**Intent**: Lock preserve-unknown and date modes before Update depends on them.

**Contract**: Cases include: VALARM preserved; RRULE preserved; X-* preserved; UID round-trip; `VALUE=DATE` all-day; TZID on DTSTART/DTEND; folding/escaping; empty optional props not forced on serialize-from-create.

#### 4. Live Calendar fidelity checks

**File**: `test/n8n-cli/calendar/`

**Intent**: Create an event via the node, Get it, confirm core fields and that server-stored ICS is not trivially empty of DESCRIPTION when unset (and location when set).

**Contract**: Webhook-triggered workflow JSON + README with hybrid n8n-cli/curl steps. Separate from Phase 4 partial-update workflows (e.g. `01-create-get-fidelity.json`).

### Success Criteria:

#### Automated Verification:

- Unit ICS round-trip tests pass: `npm test`
- Lint passes: `npm run lint`
- Create path compiles and uses serializer (no orphaned minimal-string builder required for Create)

#### Manual Verification:

- Hybrid: Calendar create→get workflow succeeds (cli create/activate + curl + `execution get`)
- Spot-check: created event appears correctly in Nextcloud Calendar UI

---

## Phase 4: Calendar Partial Update

### Overview

Wire GET → AST patch → SEQUENCE/DTSTAMP → PUT; expose Google-style Update Fields including location, all-day, and timezone; add live partial-update workflows.

### Changes Required:

#### 1. Patch helper

**File**: `nodes/NextcloudCalendar/ics/patchEvent.ts` (or equivalent)

**Intent**: Apply a partial patch onto the target VEVENT in the AST using the Phase 4 whitelist; enforce SEQUENCE/DTSTAMP/UID rules from Critical Implementation Details.

**Contract**: Whitelist: `summary`, `description`, `start`, `end`, `location`, all-day mode, timezone/TZID. Unspecified fields leave existing properties untouched (including not blanking DESCRIPTION). Keep UID from GET. Refresh DTSTAMP always on write. Bump SEQUENCE per rules above.

#### 2. Event Update execute path

**File**: `nodes/NextcloudCalendar/resources/event/update.ts`

**Intent**: Fetch raw ICS (same Accept/url pattern as Get), parse AST, apply patch from Update Fields, serialize, PUT.

**Contract**: No verbose-JSON merge. Identity params remain calendar + eventId. Empty Update Fields → `NodeOperationError` (same policy as Files empty `fieldsToUpdate`).

#### 3. Update Fields UI

**File**: `nodes/NextcloudCalendar/resources/event/index.ts` (+ descriptions if split)

**Intent**: Align with Google Calendar: required identity only; writable fields under **Update Fields** collection.

**Contract**: Collection options cover summary, description, start, end, location, all-day, timezone (names/UX in service language, not raw CalDAV jargon). Remove required summary/start/end on Update (keep required on Create as appropriate).

#### 4. Types

**File**: `nodes/NextcloudCalendar/EventInterface.ts`

**Intent**: Express partial update / timezone / all-day inputs the patch helper consumes.

**Contract**: Types used by Update + patch; Create may share date helpers.

#### 5. Unit tests for patch + SEQUENCE

**File**: `nodes/NextcloudCalendar/test/`

**Intent**: Cover preserve-unknown under patch, SEQUENCE bump/no-bump, all-day and TZID overlays, UID stability.

**Contract**: At least: patch summary keeps RRULE/ATTENDEE/VALARM; no-op does not bump SEQUENCE; meaningful change bumps; all-day emits `VALUE=DATE`; timed with TZID preserved when timezone field unset.

#### 6. Live partial-update workflows

**File**: `test/n8n-cli/calendar/`

**Intent**: Prove partial Update against real CalDAV using **generative** rich fixtures (not a single checked-in static event).

**Contract**: Separate artifacts from Phase 3 (e.g. `02-partial-update-preserves-rich-ics.json`, `03-sequence-and-times.json`). Add `@faker-js/faker` as a **devDependency**. Add a small generator under `test/n8n-cli/calendar/` (e.g. `generate-rich-event.mjs` or `fixtures/generate.mts`) that:
- builds a structurally rich VEVENT (template includes RRULE and/or VALARM and representative non-whitelist props; optional ATTENDEE when the target calendar ACL allows),
- fills variable fields (summary, description, location, times) via faker,
- emits `.ics` (prefer Phase 3 serializer once available; until then a checked-in structural template string with faker substitutions is OK for bootstrap),
- documents seed steps (curl CalDAV PUT to the test calendar, or a one-shot seed workflow).
README covers hybrid run (create → activate → curl → `execution get`): run generator → seed → run partial-update workflows → confirm SEQUENCE and preserve-unknown via Get / spot-check. Do not rely on node Create alone for rich structure.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Phase 4 workflow JSON files present under `test/n8n-cli/calendar/`
- `@faker-js/faker` is a devDependency; calendar fixture generator script exists and documented in the calendar n8n-cli README

#### Manual Verification:

- Hybrid: partial-update workflows succeed (cli + webhook curl + `execution get`)
- Rich properties survive Update (spot-check ICS or Nextcloud UI)
- SEQUENCE increases on meaningful edits; DTSTAMP refreshes
- Create still works after serializer migration (regression)

---

## Phase 5: Files Update Fields Collection

### Overview

Restructure Files share Update UI to Google-style **Update Fields** collection; keep sparse PUT builder; add Files n8n-cli live checks.

### Changes Required:

#### 1. Collection UI

**File**: `nodes/NextcloudFiles/shared/descriptions.ts`, `resources/share/index.ts`

**Intent**: Replace `multiOptions` “Fields to Update” + gated sibling params with a single **Update Fields** collection whose options are `permissions`, `password`, `expireDate`, `publicUpload`.

**Contract**: Display name **Update Fields**; `name` may remain `updateFields`. Nested option `permissions` can use that name inside the collection (drop `updatePermissions` alias). Create operation siblings unchanged. Empty collection rejected at execute/builder (same error as empty multiOptions).

#### 2. Execute mapping

**File**: `nodes/NextcloudFiles/resources/share/update.ts`

**Intent**: Read collection object; derive `fieldsToUpdate = Object.keys(updateFields)` and values from nested properties; call existing `buildShareUpdateBody`.

**Contract**: `buildShareUpdateBody` signature unchanged. Clear-by-empty password/expireDate and `publicUpload: false` when key present still work. GET for `shareType` sanitization unchanged.

#### 3. Live Files verification

**File**: `test/n8n-cli/files/`

**Intent**: Update a share via collection (e.g. expireDate and/or permissions) and confirm OCS result.

**Contract**: Webhook-triggered workflow JSON + README with hybrid n8n-cli/curl steps; document target share id / create-share setup.

### Success Criteria:

#### Automated Verification:

- Existing `buildShareUpdateBody` unit tests still pass: `npm test`
- Lint passes: `npm run lint`
- `test/n8n-cli/files/` contains workflow + README

#### Manual Verification:

- Hybrid: Files workflow succeeds (cli + webhook curl + `execution get`)
- Sparse PUT behavior: only selected collection keys change on the share
- Clearing password / setting `publicUpload: false` when added to the collection still works

---

## Phase 6: Suite Update Convention

### Overview

Record the suite-wide Update contract for implementers of Talk / Tasks / Contacts (and future Update ops) without inventing field lists.

### Changes Required:

#### 1. Foundation convention note

**File**: `context/foundation/update-convention.md` (new)

**Intent**: Document the two golden paths, Calendar ICS translator rule, UX (Update Fields collection), anti-pattern (`mergeDefined(fullGet, patch)`), and pointer to `test/n8n-cli/` tradition.

**Contract**: Sections at minimum: Full-object PUT whitelist-merge; Sparse PUT + Update Fields; CalDAV/CardDAV → Calendar-owned ICS lessons (Tasks/Contacts TBD when API chosen); explicit “do not invent whitelists until API selected” for Talk/Tasks/Contacts; note Deck Move still uses legacy merge (known debt). Link from `context/foundation/README.md`.

#### 2. Change notes sync

**File**: `context/changes/suite-partial-update/change.md`

**Intent**: Point to the foundation convention and n8n-cli tradition as outcomes of this change.

**Contract**: Brief notes only; status remains whatever implement/archive skills set later.

### Success Criteria:

#### Automated Verification:

- Files exist: `context/foundation/update-convention.md`; README links to it

#### Manual Verification:

- Skim: a new contributor could choose the correct Update pattern for a hypothetical new app from the note alone

---

## Testing Strategy

### Unit Tests:

- Deck: `buildCardUpdatePayload` whitelist / exclude nested / clear duedate
- Calendar ICS: round-trip preserve-unknown; DATE vs DATE-TIME; TZID; patch + SEQUENCE rules
- Files: existing `buildShareUpdateBody` tests remain source of truth for sparse body

### Integration / live (n8n-cli tradition):

- `test/n8n-cli/deck/` — card partial Update preserves labels
- `test/n8n-cli/calendar/` — create/get fidelity (Phase 3); generative rich fixtures (`@faker-js/faker`) + partial Update + SEQUENCE (Phase 4)
- `test/n8n-cli/files/` — Update Fields collection → sparse share Update

### Manual Testing Steps:

1. Configure `N8N_URL` + `N8N_API_KEY` (or `n8n-cli config`); confirm `workflow list`
2. Build/link community node; per app README: `workflow create` → `activate` → `curl` webhook → `execution get`
3. Spot-check Nextcloud UI for Calendar rich-event survival and Deck labels after Update
4. Confirm Deck Move unchanged (smoke)

## Performance Considerations

ICS parse/serialize is per-item on Update/Create; acceptable for single-event ops. No batch Update in scope. Avoid re-fetching beyond one GET per Update.

## Migration Notes

- Pre-1.0 package: Calendar Update param shape changes (required → Update Fields); Files `updateFields` string[] + siblings → collection object — existing saved workflows may break; document in PR / convention note.
- Deck card Update UI largely unchanged (payload safety fix only).
- No data migration on Nextcloud side.

## References

- Related research: `context/changes/suite-partial-update/research.md`
- Roadmap S-09: `context/foundation/roadmap.md`
- Board whitelist: `nodes/NextcloudDeck/GenericFunctions.ts` (`buildBoardUpdatePayload`)
- Card anti-pattern: `nodes/NextcloudDeck/resources/card/update.ts`
- Files sparse PUT: `nodes/NextcloudFiles/GenericFunctions.ts` (`buildShareUpdateBody`)
- Calendar clobber Update: `nodes/NextcloudCalendar/resources/event/update.ts`
- F2 deferral: `context/archive/2026-07-18-nextcloud-deck/reviews/impl-review-phase-2.md`
- n8n-cli skill: `@n8n/cli` workflow/execution commands against local instance

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: n8n-cli Live Verification Tradition

#### Automated

- [ ] 1.1 Paths exist: test/n8n-cli/README.md and deck/calendar/files folders
- [ ] 1.2 README documents hybrid model (CLI create/activate/inspect, Webhook+curl start, no CLI execute)

#### Manual

- [ ] 1.3 n8n-cli workflow list succeeds against local n8n

### Phase 2: Deck Card Whitelist

#### Automated

- [ ] 2.1 Unit tests pass for buildCardUpdatePayload
- [ ] 2.2 Lint passes
- [ ] 2.3 test/n8n-cli/deck/ has workflow artifact(s) + README

#### Manual

- [ ] 2.4 Hybrid Deck workflow succeeds (cli create/activate + curl + execution get)
- [ ] 2.5 Updated card retains labels/assignees; only intended fields change
- [ ] 2.6 Deck Move smoke still works

### Phase 3: Calendar ICS Translator

#### Automated

- [ ] 3.1 Unit ICS round-trip tests pass
- [ ] 3.2 Lint passes
- [ ] 3.3 Create path uses serializer

#### Manual

- [ ] 3.4 Hybrid Calendar create→get workflow succeeds
- [ ] 3.5 Created event looks correct in Nextcloud Calendar UI

### Phase 4: Calendar Partial Update

#### Automated

- [ ] 4.1 Unit tests pass (patch, SEQUENCE, preserve-unknown)
- [ ] 4.2 Lint passes
- [ ] 4.3 Phase 4 workflow JSON present under test/n8n-cli/calendar/
- [ ] 4.8 faker-js devDependency + calendar rich-event generator script documented

#### Manual

- [ ] 4.4 Hybrid partial-update workflows succeed
- [ ] 4.5 Rich ICS properties survive Update
- [ ] 4.6 SEQUENCE bumps on meaningful edits; DTSTAMP refreshes
- [ ] 4.7 Create regression still works

### Phase 5: Files Update Fields Collection

#### Automated

- [ ] 5.1 buildShareUpdateBody unit tests still pass
- [ ] 5.2 Lint passes
- [ ] 5.3 test/n8n-cli/files/ has workflow + README

#### Manual

- [ ] 5.4 Hybrid Files workflow succeeds
- [ ] 5.5 Only selected collection keys change on the share
- [ ] 5.6 Clear password / publicUpload false still work when keys present

### Phase 6: Suite Update Convention

#### Automated

- [ ] 6.1 context/foundation/update-convention.md exists and README links to it

#### Manual

- [ ] 6.2 Convention note alone is enough to pick the correct Update pattern for a new app
