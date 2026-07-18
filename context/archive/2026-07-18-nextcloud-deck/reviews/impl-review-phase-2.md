<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Nextcloud Deck (boards/cards) — Phase 2

- **Plan**: context/changes/nextcloud-deck/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-07-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Card update always patches `type: plain`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudDeck/NextcloudDeck.node.ts:354-368
- **Detail**: Card Update reads the hidden `type` parameter (default `'plain'`) and always includes it in the patch because `if (type.trim())` is always true. Any partial update on a non-plain card risks overwriting its type.
- **Fix**: Omit `type` from the update patch unless intentionally exposed/changed; mirror board update's "empty = keep current" semantics for hidden fields.
  - Strength: Prevents silent data clobber on partial updates; aligns with plan's GET→merge→PUT intent.
  - Tradeoff: Minor — remove 3 lines from update handler.
  - Confidence: HIGH — hidden default is the root cause.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Card update PUT sends full GET entity

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudDeck/NextcloudDeck.node.ts:370-375
- **Detail**: Card Update uses `mergeDefined(current, patch)` on the full GET response. Board Update (Phase 1) uses whitelisted `buildBoardUpdatePayload`. Deck card GET responses may include nested/read-only fields that PUT could reject or mishandle.
- **Fix A ⭐ Recommended**: Add `buildCardUpdatePayload(current, patch)` whitelisting writable fields (`title`, `description`, `duedate`, `type`, `order`), mirroring board.
  - Strength: Matches established Phase 1 pattern; reduces API rejection risk.
  - Tradeoff: Small helper + test; need to confirm Deck PUT field set in Phase 3 smoke.
  - Confidence: MED — field whitelist may need tuning against live API.
  - Blind spot: Exact writable field set not verified on real instance yet.
- **Fix B**: Keep mergeDefined but strip known read-only keys before PUT
  - Strength: Preserves any extra writable fields Deck returns.
  - Tradeoff: Denylist is fragile if API adds nested objects.
  - Confidence: LOW — harder to maintain than whitelist.
  - Blind spot: Unknown read-only keys on production Deck versions.
- **Decision**: SKIPPED — defer to roadmap (card update whitelist / safe merge pattern)

### F3 — `formatDeckDueDate` lacks invalid-date guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudDeck/GenericFunctions.ts:176-180
- **Detail**: `new Date(dueDate).toISOString()` throws `RangeError` on invalid input instead of a friendly `NodeOperationError`.
- **Fix**: Guard with `Number.isNaN(parsed.getTime())` and throw `NodeOperationError` with a clear message (or return `null` when empty/invalid per call-site contract).
- **Decision**: FIXED

### F4 — Card `title` not marked required in UI on create

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudDeck/resources/card/index.ts:68-80
- **Detail**: Plan specifies `title` required on create in descriptions. Validation exists in execute, but the field lacks `required: true` (stack create has it).
- **Fix**: Add `required: true` to the title field when `operation: ['create']` (split field or use displayOptions-scoped duplicate if n8n requires).
- **Decision**: FIXED

### F5 — Card update cannot clear due date

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudDeck/NextcloudDeck.node.ts:363-365
- **Detail**: Empty `dueDate` on update is skipped, so existing `duedate` persists. Create correctly sends `null` for empty dates.
- **Fix**: Defer to Phase 3 — confirm whether authors need explicit clear; if yes, add "Clear due date" boolean or treat cleared dateTime as `patch.duedate = null`.
- **Decision**: FIXED — added `clearDueDate` in Additional Fields on card update

### F6 — `cardId` lacks trim/empty preflight

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudDeck/NextcloudDeck.node.ts:312,345,385,399
- **Detail**: Board/stack use `resolveBoardId` / `resolveStackId`; `cardId` is passed raw, yielding opaque 404s on whitespace/empty input.
- **Fix**: Add `resolveCardId()` helper and use consistently.
- **Decision**: FIXED

### F7 — Card Get Many fetches full board stacks client-side

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudDeck/NextcloudDeck.node.ts:324-340
- **Detail**: Always fetches all stacks with nested cards, then filters/limits client-side. Plan explicitly accepts this for MVP; `stackFilter` mitigates post-fetch only.
- **Fix**: No code change required now; document in README or node description; revisit if large boards appear in Phase 3.
- **Decision**: FIXED — documented client-side fetch behavior on card Get Many stack filter field
