<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Validation Refactoring (F-02)

- **Plan**: context/changes/validation-refactoring/plan.md
- **Scope**: Phases 1–6 of 8 (7–8 not yet implemented)
- **Date**: 2026-07-21
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Shared `throwPollError` still casts `as JsonObject`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: nodes/shared/pollOrchestration.ts:24
- **Detail**: Phase 1 added `nodeApiErrorPayload` specifically to eliminate `as JsonObject` at NodeApiError sites, but `throwPollError` still does `throw new NodeApiError(context.getNode(), { message } as JsonObject)`. This is the only remaining non-allowlisted prod cast outside the expected WebDAV×2 + poll-adapter×2 set, and it sits on the shared poll path used by NewsTrigger and FilesTrigger.
- **Fix**: Replace `{ message } as JsonObject` with `nodeApiErrorPayload(message)` from `nodes/shared/parse.ts`; drop unused `JsonObject` import if unused.
  - Strength: One-line; matches every node listSearch/node error path already migrated.
  - Tradeoff: Negligible; existing `pollOrchestration` tests should still pass.
  - Confidence: HIGH — helper already used suite-wide.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — `parseShareId` not aligned with shared `parsePositiveInt`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:492-503
- **Detail**: Phase 2 said to prefer shared primitives where equivalent. `parseShareId` reimplements the same coercion path but allows non-integers (`3.5` passes) while `parsePositiveInt` requires `Number.isInteger`. Message text also differs ("positive number" vs "positive integer").
- **Fix A ⭐ Recommended**: Delegate to `parsePositiveInt(value, 'Share ID')` (optionally wrap message).
  - Strength: Matches plan intent; tightens invalid share ids.
  - Tradeoff: Slightly stricter than prior behavior for fractional ids (unlikely from NC).
  - Confidence: HIGH — share ids are integers in OCS.
  - Blind spot: Haven't audited all call sites for fractional expression results.
- **Fix B**: Keep local `parseShareId` but add `Number.isInteger` check and document why it stays separate.
  - Strength: Preserves dedicated Share-ID messaging.
  - Tradeoff: Still duplicates logic.
  - Confidence: MEDIUM.
  - Blind spot: Future drift risk remains.
- **Decision**: FIXED (removed `parseShareId`; call sites use `parsePositiveInt` directly)

### F3 — `parseLocatorParamValue` triplicated across Files/News/Deck

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudFiles/resources/shared/resolveInput.ts:33; nodes/NextcloudNews/resources/shared/resolveInput.ts:7; nodes/NextcloudDeck/resources/shared/resolveInput.ts:33
- **Detail**: Identical RLC/scalar extractors were copied into three node trees (FilesTrigger correctly imports Files'). Plan pushed shared helpers for cross-cutting parse work; this helper is now suite-wide but not centralized.
- **Fix A ⭐ Recommended**: Move `parseLocatorParamValue` into `nodes/shared/parse.ts` (or `shared/resolveInput.ts`) and re-export/import from each node.
  - Strength: One source of truth; Phase 7/8 less likely to miss a copy.
  - Tradeoff: Touches three import graphs + tests if any import paths break.
  - Confidence: HIGH — bodies are identical today.
  - Blind spot: Whether any node-local specialization is planned later.
- **Fix B**: Leave triplicated until a later cleanup change; document as known DRY debt in `change.md`.
  - Strength: Zero risk now; doesn't block Phase 7–8.
  - Tradeoff: Drift risk remains.
  - Confidence: HIGH for deferral safety.
  - Blind spot: None significant.
- **Decision**: FIXED (via Fix A — centralized in `nodes/shared/parse.ts`)

### F4 — FilesTrigger `getSnapshot` silently drops invalid entries

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFilesTrigger/pollDirectory.ts:54-74
- **Detail**: Structural parse skips entries when `isFolder` is not a boolean. Soft behavior avoids throws, but a corrupted/legacy snapshot can shrink silently and cause the next classify pass to emit spurious `*Created` events for dropped paths. No dedicated unit tests cover malformed snapshot shapes (test bar was intentionally light — this is an under-proven parser).
- **Fix A ⭐ Recommended**: Keep soft skip but `context.logger.debug/warn` when dropping entries (needs logger plumbing or return a drop count from `getSnapshot` for the poll path to log); add 1–2 unit tests for malformed entries.
  - Strength: Preserves soft-fail; makes floods diagnosable; addresses change.md test-bar reminder for a hot-path parser.
  - Tradeoff: Small API/test surface.
  - Confidence: MEDIUM — logging API choice needs a quick look at IPollFunctions logger usage.
  - Blind spot: How often staticData serialization could coerce booleans to strings.
- **Fix B**: Coerce common string forms (`'true'`/`'false'`) for `isFolder` and only skip truly invalid shapes; add tests.
  - Strength: More resilient to serialization quirks.
  - Tradeoff: Masks bad data instead of surfacing it.
  - Confidence: MEDIUM.
  - Blind spot: Whether n8n staticData ever stringifies booleans.
- **Decision**: FIXED (via Fix A — soft skip + logger.debug + unit tests)

### F5 — News entity schemas use `z.coerce.number()` + `.passthrough()` without tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNews/GenericFunctions.ts:~138-174
- **Detail**: Per change.md pre-impl-review reminder: light test bar is intentional, but push for tests if parsers look under-proven. News unwrap schemas coerce ids (`null`→`0`, `"1.5"`→`1.5`) and `.passthrough()` keeps unknown fields. Existing News tests cover operations more than schema edge cases.
- **Fix A ⭐ Recommended**: Tighten id fields to `z.number().int().positive()` (or coerce then refine integer/positive) and add a small unit test file for `unwrapFolders`/`unwrapItems` bad payloads.
  - Strength: Fail loud on bad API/param data; matches Deck-ish strictness.
  - Tradeoff: May reject previously-tolerated weird payloads.
  - Confidence: MEDIUM — need to confirm NC News always returns numeric ids.
  - Blind spot: Live API quirks for coerce-on-string ids from expressions.
- **Fix B**: Keep schemas; add tests only documenting current coerce/passthrough behavior.
  - Strength: No runtime behavior change.
  - Tradeoff: Leaves loose parsing.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (coerce then `.int().positive()` on folder/feed/item `id`; no new tests per triage)

### F6 — `parseItemIds` `JSON.parse` lacks try/catch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNews/GenericFunctions.ts:~329-331
- **Detail**: When raw text starts with `[`, `JSON.parse` can throw `SyntaxError` with the raw input. Elsewhere parsers use `throwParseError` / user-facing `Error` messages.
- **Fix**: Wrap in try/catch and `throw new Error('Item ids must be a valid JSON array or comma-separated list')` (or `throwParseError`).
  - Strength: Consistent UX; tiny change.
  - Tradeoff: None material.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED

### F7 — Zod declared in `devDependencies` not `peerDependencies`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: package.json; change.md §Implementation adaptations
- **Detail**: Plan required peerDependency; implementation correctly used `devDependencies` because community-node lint forbids non-allowlisted peers / runtime dependencies. Documented in `change.md`. `n8n.strict` remains true; no `dependencies.zod`.
- **Fix**: No code change. Optionally mirror the note into the plan Overview if future readers skip `change.md`.
- **Decision**: FIXED (adaptation note added to `plan.md` Phase 1 Zod section)

### F8 — Calendar OAuth credential schema remains node-local

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: nodes/NextcloudCalendar/GenericFunctions.ts (local `nextcloudOAuth2CredentialSchema`); EventInterface.ts local `NextcloudCredentialData`
- **Detail**: Plan said shared parse for whichever credential Calendar selects. Implementation uses shared `parseNextcloudCredentials` for basic and a local Zod schema for OAuth — matching the Phase 1 `parse.ts` comment deferring OAuth assembly. Runtime is cast-free for both paths. Wider Calendar `NextcloudCredentialData` type is intentional, not a stale duplicate.
- **Fix**: Document as an explicit adaptation in `change.md` (parallel to Zod placement), or defer shared OAuth schema to a follow-up. No must-fix for Phase 7.
- **Decision**: FIXED (documented in `change.md` §Implementation adaptations)

### F9 — No dedicated unit tests for new shared/`parse.ts` helpers

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: nodes/shared/parse.ts (no sibling `parse.test.ts`)
- **Detail**: Plan and change.md intentionally set a light test bar (existing suites + typecheck). All 227 tests pass. Highest-value gaps are already called out in F4/F5 rather than blanket coverage of every primitive.
- **Fix**: Optional follow-up: add focused tests for `parseNextcloudCredentials`, `nodeApiErrorPayload`, and any parsers touched by F4/F5 fixes — not a Phase 1–6 blocker.
- **Decision**: FIXED (`nodes/shared/test/parse.test.ts` for credentials, NodeApiError payload, parsePositiveInt, parseLocatorParamValue)

### F10 — ICS TEXT escaping incomplete in `buildICalendarPayload` (out of F-02 scope)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/GenericFunctions.ts (~buildICalendarPayload)
- **Detail**: Safety review flagged incomplete RFC 5545 TEXT escaping (`\n` only; `\r`, `\`, `,`, `;` unhandled) as a possible CRLF/property-injection class. Plan explicitly excludes rewriting ICS/XML content parsers unless they use avoidable param/credential `as` casts. This path was not introduced by F-02 cast removal; treating as follow-up outside this change rather than a Phase 1–6 reject.
- **Fix**: Track as a separate security hardening change (dedicated `escapeIcsTextValue`); do not block validation-refactoring Phase 7–8.
- **Decision**: PENDING

## Success criteria evidence (Phases 1–6)

| Check | Result |
|-------|--------|
| `npm exec tsc --noEmit` | PASS (exit 0) |
| `npm test` | PASS (18 files / 227 tests) |
| `npm run lint` | PASS (0 errors; 8 pre-existing icon warnings) |
| `dependencies.zod` absent | PASS |
| `n8n.strict === true` | PASS |
| `eslint.config.mjs` unchanged CLI default | PASS |
| credentials/ prod `as` | PASS (zero) |
| Deck prod `as` | PASS (zero) |
| News entityJson cast-free | PASS |
| Remaining expected boundaries | Files method, Calendar method, NewsTrigger adapter, FilesTrigger adapter |
| Unexpected leftover | `pollOrchestration.ts:24` (F1) |

## Progress manual items

Phases 1–6 Manual Progress rows are all `[x]`. Cast inventories were verified via ast-grep during implementation (user-directed). No rubber-stamp red flags beyond F1 (shared leftover outside the per-node greps).
