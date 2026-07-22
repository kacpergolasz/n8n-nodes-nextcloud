<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Validation refactoring (commit a62aa06)

- **Plan**: `context/changes/validation-refactoring/plan.md`
- **Scope**: Post-close Phase 6 follow-up — commit `a62aa06` only (not full plan)
- **Date**: 2026-07-22
- **Verdict**: APPROVED
- **Findings**: 0 critical / 1 warning / 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Corrupt snapshot + empty listing can seed `{}` and flood later

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `nodes/NextcloudFilesTrigger/pollDirectory.ts:248-264`
- **Detail**: With `hasSnapshot` fail-closed, `isInitialized` is false before the empty-listing soft-fail. A rare double fault (invalid/corrupt entries **and** a transient empty listing on the same poll) now hits `seedDirectoryPollState(..., [])` and writes `{}`. The next real listing then emits every child as created. Pre-fix, a mixed valid+invalid snapshot could keep `priorCount > 0` after `getSnapshot` drops and soft-fail. The main Bugbot create-flood (invalid keys while still “initialized”) is correctly closed.
- **Fix A ⭐ Recommended**: Accept risk — document as rare double-fault; keep fail-closed re-seed for corrupt snapshots
  - Strength: Preserves the primary fix; soft-fail only makes sense with a usable prior; corrupt+empty is pathological.
  - Tradeoff: Leaves a narrow secondary flood path.
  - Confidence: HIGH — empty soft-fail is intentionally gated on initialized+non-empty prior.
  - Blind spot: No telemetry on how often corrupt snapshots appear in the wild.
- **Fix B**: Before seeding when snapshot object exists but fails entry validation, if `listing.length === 0`, keep prior raw snapshot / skip seed (or soft-fail)
  - Strength: Closes the double-fault path for mixed/corrupt + empty.
  - Tradeoff: More special cases in the init gate; may retain unusable staticData longer.
  - Confidence: MEDIUM — needs careful tests for all-invalid vs mixed.
  - Blind spot: Whether keeping corrupt bytes is ever useful vs always re-seeding on next non-empty listing.
- **Decision**: ACCEPTED — Fix A (keep fail-closed re-seed; rare double-fault)

### F2 — Progress/docs do not record a62aa06

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `context/changes/validation-refactoring/plan.md` Progress Phase 6; `change.md` Notes
- **Detail**: Phase 6 Progress rows still cite `a4e0375`. Post-close bugfix `a62aa06` is not appended to Progress or Notes. Code is in-scope for Phase 6 staticData parsing; only the change ledger lags.
- **Fix**: Add a short Notes bullet under Implementation adaptations (and optionally a Phase 6 Progress addendum line) pointing at `a62aa06`.
- **Decision**: FIXED — Notes adaptation + Progress 6.5 → a62aa06

### F3 — `getSnapshot` drop+log unreachable on poll path after gate

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `nodes/NextcloudFilesTrigger/pollDirectory.ts:70-101` vs `224-253`
- **Detail**: `runDirectoryPoll` only calls `getSnapshot` after `hasSnapshot` already validated every entry, so `droppedCount > 0` logging cannot fire in the poll path. Still reachable via the exported helper and unit tests (defense-in-depth).
- **Fix**: Keep as defense-in-depth (no code change), or add a one-line comment that drop+log is for direct callers.
- **Decision**: FIXED — comment noting drop+log is for direct callers / defense-in-depth

## Automated verification (scoped)

| Check | Result |
|-------|--------|
| `npm test -- nodes/NextcloudFilesTrigger/test/NextcloudFilesTrigger.poll.test.ts` | PASS (15 tests) |
| `npm exec tsc --noEmit` | PASS |
| Grep FilesTrigger prod for type `as` (excl. `as const` / comments) | PASS — only `as const` in listSearch |

## Commit under review

- `a62aa06` — `fix(FilesTrigger): re-seed when snapshot entries fail validation`
- Touches: `pollDirectory.ts`, `NextcloudFilesTrigger.poll.test.ts`
