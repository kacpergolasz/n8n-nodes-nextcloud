# Nextcloud News Trigger Simplification Implementation Plan

## Overview

Stabilize `NextcloudNewsTrigger` as the suite reference for ID-based polling by fixing the remaining catch-up correctness bug, simplifying state around monotonic `lastIdRead` (`maxProcessedId`), and exposing bounded polling controls per node (`pageSize`, `maxPagesPerPoll`). After behavior is stable and verified, extract only reusable poll lifecycle orchestration helpers for future triggers.

## Current State Analysis

The trigger already uses monotonic IDs and a watermark, but still carries legacy complexity and one open correctness gap in catch-up orchestration. The frame settled the detection model decision: stay ID-first and simplify state, not switch to `/items/updated`.

Current implementation also hardcodes burst behavior (`batchSize=100`, steady cap=10) in runtime and tests, which blocks per-workflow tuning. Files and News triggers share lifecycle patterns conceptually, but code reuse is minimal outside `pollHelpers`.

## Desired End State

`NextcloudNewsTrigger` emits new articles based on monotonic ID truth with no permanent skip paths under bounded catch-up polling. Node authors can tune polling limits safely via trigger parameters, with defaults of `pageSize=100` and `maxPagesPerPoll=5`.

Shared lifecycle behavior (bootstrap+scrub, initialized soft-fail policy, manual sample handling) is extracted into `nodes/shared` helpers without forcing News-specific state/paging logic onto other triggers.

### Key Discoveries:

- B1 remains open in catch-up control flow: `loadTriggerItemsWithCatchUp` clears resume state on peek `exhausted` before resume pass runs in prior-offset scenarios (`nodes/NextcloudNewsTrigger/pollNews.ts`).
- Newness is already gated by watermark (`id > watermark`) while ring buffer still influences orchestration complexity (`nodes/NextcloudNewsTrigger/pollNews.ts`).
- Parameterization and regression tests are tightly coupled to hardcoded values (`nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`).
- Files and News share orchestration concepts (init gate, soft-fail, manual sample) but should keep fetch/state/classify app-specific (`nodes/NextcloudFilesTrigger/pollDirectory.ts`, `nodes/NextcloudNewsTrigger/pollNews.ts`).

## What We're NOT Doing

- Switching to `GET /items/updated` in this change.
- Building a generic polling engine for all apps.
- Changing event scope beyond "new article IDs" semantics.
- Refactoring Files/Calendar/Deck detection logic into shared code in this pass.

## Implementation Approach

Use a staged approach:
1) correctness-first fix and state simplification in News trigger;
2) add bounded controls as node parameters and wire through runtime;
3) only after tests pass, extract lifecycle helpers with policy hooks.

This keeps behavioral risk low while producing a reusable reference pattern.

## Phase 1: Correctness and ID-State Stabilization

### Overview

Fix the B1 resume-loss path and simplify state semantics so `maxProcessedId` is the only durable newness truth. Keep ring-buffer behavior limited to dedupe support, not stop/newness authority.

### Changes Required:

#### 1. Catch-up Control Flow

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts`

**Intent**: Fix the `peek exhausted` early-return bug so pending resume is not cleared when `catchUpOffset` exists.

**Contract**: `loadTriggerItemsWithCatchUp()` must preserve/continue resume when `priorOffset` is present and top peek exhausts; only clear catch-up when completion criteria are truly met.

#### 2. State Semantics Cleanup

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts`

**Intent**: Reduce ring-buffer dependence in orchestration decisions and keep monotonic watermark as the authoritative "already seen" boundary.

**Contract**: Emission/newness decisions remain based on `id > pre-poll watermark`; ring buffer remains auxiliary dedupe only. Remove dead/unreachable catch-up cleanup branch.

#### 3. Regression Coverage for B1 and Resume Paths

**File**: `nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`

**Intent**: Lock in corrected behavior with focused tests around resumed catch-up when top peek returns exhausted/partial pages.

**Contract**: Add a regression test proving prior `catchUpOffset` survives and is consumed correctly in the B1 scenario; retain coverage for existing burst and soft-fail resume flows.

### Success Criteria:

#### Automated Verification:

- Trigger poll tests pass after B1 fix: `pnpm vitest nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`
- No regression in shared pagination tests: `pnpm vitest nodes/shared/test/pagination.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Simulated pending-resume scenario no longer loses older gap when top peek is exhausted
- Trigger still emits only IDs newer than previous watermark
- Unread-only seed behavior still prevents read→unread false fire for pre-existing items

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Configurable Poll Limits (Default 100 / 5)

### Overview

Expose node-configurable burst controls and thread them through polling runtime while preserving no-history-flood initialization and no-permanent-skip guarantees.

### Changes Required:

#### 1. Trigger Parameter Surface

**File**: `nodes/NextcloudNewsTrigger/NextcloudNewsTrigger.node.ts`

**Intent**: Add advanced configuration parameters for polling bounds.

**Contract**: Introduce node parameters for `pageSize` (default `100`) and `maxPagesPerPoll` (default `5`) with safe numeric constraints and clear descriptions.

#### 2. Runtime Wiring for Configurable Bounds

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts`

**Intent**: Replace hardcoded steady/seed paging assumptions with parameter-driven values.

**Contract**: Poll runtime reads configured values from node parameters; `loadTriggerItemsPage`, seed walk, and steady catch-up all honor effective config while preserving watermark advancement rules.

#### 3. Test Updates for Parameterized Behavior

**File**: `nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`

**Intent**: Remove hardcoded expectations bound to `100` and old steady cap behavior.

**Contract**: Add/adjust tests to validate custom `pageSize` and `maxPagesPerPoll`, including persisted `catchUpOffset` + delayed watermark advancement + next-poll resume completion.

### Success Criteria:

#### Automated Verification:

- Updated trigger tests validate defaults and overrides: `pnpm vitest nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`
- Node compiles with new parameter schema: `pnpm typecheck`
- Lint passes for trigger and test edits: `pnpm lint`

#### Manual Verification:

- With defaults, trigger behavior remains backward-compatible for normal feeds
- With smaller configured limits, trigger resumes across polls without permanent gaps
- Node UI shows new controls with sane defaults and descriptive help text

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Extract Shared Poll Lifecycle Harness

### Overview

Extract minimal reusable lifecycle/orchestration helpers from Files + News while keeping app-specific fetch/classify/state logic local.

### Changes Required:

#### 1. Shared Lifecycle Helper Module

**File**: `nodes/shared/pollOrchestration.ts` (new)

**Intent**: Centralize common poll orchestration concerns discovered across Files and News.

**Contract**: Provide helpers for (a) bootstrap + scrubbed pre-init error envelope, (b) initialized soft-fail policy with mode hooks (`silent` / `oneShotNotice`), and (c) manual sample "one item or null" behavior.

#### 2. News Trigger Adoption

**File**: `nodes/NextcloudNewsTrigger/pollNews.ts`

**Intent**: Replace duplicated orchestration boilerplate with shared helpers without changing News-specific paging/state logic.

**Contract**: News keeps existing semantics (including one-shot notice policy and scope precedence) while delegating lifecycle envelopes to shared helpers.

#### 3. Files Trigger Adoption

**File**: `nodes/NextcloudFilesTrigger/pollDirectory.ts`

**Intent**: Align Files trigger with the same shared lifecycle helpers where behavior already matches.

**Contract**: Files retains silent soft-fail policy and event-aware manual sample behavior; no changes to snapshot/classification logic.

#### 4. Pattern Documentation Update

**File**: `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md`

**Intent**: Move from prose-only convention to code-backed convention for lifecycle orchestration.

**Contract**: Document new shared helper usage and keep clear boundaries of what remains app-specific.

### Success Criteria:

#### Automated Verification:

- News trigger tests pass unchanged in behavior: `pnpm vitest nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`
- Files trigger tests pass unchanged in behavior: `pnpm vitest nodes/NextcloudFilesTrigger/test/NextcloudFilesTrigger.poll.test.ts`
- Shared helper tests (if added) pass: `pnpm vitest nodes/shared/test`
- Typecheck + lint pass for shared extraction: `pnpm typecheck && pnpm lint`

#### Manual Verification:

- News soft-fail one-shot notice behavior remains intact
- Files soft-fail silent-null behavior remains intact
- Manual/test-step behavior still returns one sample or null in both triggers

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before declaring implementation complete.

---

## Testing Strategy

### Unit Tests:

- Catch-up state transitions around `watermark` / `frontier` / `exhausted`
- B1 regression scenario with prior resume + top exhausted page
- Parameterized page-size and page-cap behavior
- Static-data compatibility for existing keys (`maxProcessedId`, `catchUpOffset`, `processedIds`, `pollScope`)

### Integration Tests:

- Multi-poll burst scenario with cap-hit resume until watermark reached
- Soft-fail window behavior across failure then recovery
- Scope change reseed behavior (folder/feed/unread changes)

### Manual Testing Steps:

1. Trigger with default limits on a normal feed and verify expected emissions.
2. Trigger with smaller limits to force multi-poll catch-up and verify no skips.
3. Force transient API failure after initialization and verify policy-specific recovery.

## Performance Considerations

- Lower default `maxPagesPerPoll` from 10 to 5 reduces worst-case per-poll API load.
- Configurable `pageSize` enables tuning for high/low-volume feeds without code changes.
- Watermark-only newness truth avoids large historical in-memory comparisons.

## Migration Notes

- Keep backward compatibility for existing static-data keys; do not require manual workflow resets.
- Continue tolerating and cleaning deprecated `catchUpUntilId` if present.
- Existing workflows without new params must receive default behavior (`pageSize=100`, `maxPagesPerPoll=5`).

## References

- Frame brief: `context/changes/nextcloud-news/frame.md`
- Related research: `context/changes/nextcloud-news/research.md`
- Poll implementation: `nodes/NextcloudNewsTrigger/pollNews.ts`
- Poll tests: `nodes/NextcloudNewsTrigger/test/NextcloudNewsTrigger.poll.test.ts`
- Files reference: `nodes/NextcloudFilesTrigger/pollDirectory.ts`
- Suite pattern doc: `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Correctness and ID-State Stabilization

#### Automated

- [x] 1.1 Trigger poll tests pass after B1 fix — d24170a
- [x] 1.2 Shared pagination tests pass — d24170a
- [x] 1.3 Type checking passes — d24170a
- [x] 1.4 Linting passes — d24170a

#### Manual

- [x] 1.5 Pending-resume + exhausted-peek scenario no longer loses gap — d24170a
- [x] 1.6 Trigger emits only IDs newer than prior watermark — d24170a
- [x] 1.7 Unread-only seed protections still hold — d24170a

### Phase 2: Configurable Poll Limits (Default 100 / 5)

#### Automated

- [x] 2.1 Trigger tests validate default and overridden limits — 0cdadd9
- [x] 2.2 Type checking passes with new node params — 0cdadd9
- [x] 2.3 Linting passes for trigger and tests — 0cdadd9

#### Manual

- [x] 2.4 Default-limit behavior remains backward-compatible — 0cdadd9
- [x] 2.5 Smaller-limit runs resume correctly across polls — 0cdadd9
- [x] 2.6 Node UI exposes clear advanced polling controls — 0cdadd9

### Phase 3: Extract Shared Poll Lifecycle Harness

#### Automated

- [x] 3.1 News trigger tests pass after lifecycle extraction — df37fcf
- [x] 3.2 Files trigger tests pass after lifecycle extraction — df37fcf
- [x] 3.3 Shared helper tests pass — df37fcf
- [x] 3.4 Typecheck and lint pass after extraction — df37fcf

#### Manual

- [x] 3.5 News one-shot notice soft-fail behavior preserved — df37fcf
- [x] 3.6 Files silent soft-fail behavior preserved — df37fcf
- [x] 3.7 Manual sample behavior preserved in both triggers — df37fcf
