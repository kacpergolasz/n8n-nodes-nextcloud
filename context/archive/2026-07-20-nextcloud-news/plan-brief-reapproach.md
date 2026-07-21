# Nextcloud News Trigger Simplification — Plan Brief

> Full plan: `context/changes/nextcloud-news/plan.md`  
> Frame brief: `context/changes/nextcloud-news/frame.md`  
> Research: `context/changes/nextcloud-news/research.md`

## What & Why

**The actual problem to plan around is**: News poll trigger correctness is nearly complete, but becoming a solid reference for future app triggers requires both behavior hardening and reusable orchestration structure.  

We are keeping monotonic-ID detection (`lastIdRead`/watermark) as the source of truth for "new article", simplifying state interactions, and exposing bounded polling controls (`pageSize`, `maxPagesPerPoll`) at node level. Then we extract lifecycle helpers so future triggers reuse code, not just prose conventions.

## Starting Point

Current `pollNews.ts` already emits by ID watermark but still has one open correctness issue (B1: resume lost on exhausted peek path) and high orchestration complexity. Tests encode hardcoded paging assumptions and current limits.

Files and News already share lifecycle concepts (init gate, soft-fail after init, manual sample), but implementation remains duplicated and app-specific.

## Desired End State

`NextcloudNewsTrigger` is stable under bounded burst polling with no permanent skip paths, and the node exposes safe defaults (`pageSize=100`, `maxPagesPerPoll=5`) configurable per workflow.

Reusable lifecycle orchestration helpers exist in `nodes/shared`, adopted by News and Files without forcing a generic poll engine. App-specific fetch/state/classify logic stays local.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Detection model | Keep monotonic ID-based detection | Avoids created/updated timestamp semantics drift and matches trigger "new IDs only" contract | Frame |
| API strategy | Do not switch to `/items/updated` in this change | Keeps scope controlled while simplifying current model first | Frame |
| Newness truth | `maxProcessedId` (`lastIdRead`) is authoritative | Minimizes state interaction bugs caused by overlapping stores | Frame |
| Ring buffer role | Dedupe-only support, not stop/newness authority | Retains overlap protection while reducing complexity surface | Plan |
| Burst behavior | Persist resume offset and hold watermark until catch-up completes | Prevents permanent skips under page caps | Frame |
| Config surface | Add node-configurable `pageSize` and `maxPagesPerPoll` | Gives workflow-level tuning with bounded defaults | Frame |
| Default limits | `pageSize=100`, `maxPagesPerPoll=5` | Balanced load vs convergence, explicitly requested | Frame |
| Extraction scope | Lifecycle/orchestration helpers only | Safe incremental reuse without over-generalizing app-specific logic | Plan |
| Verification bar | Targeted regressions + full trigger suite before extraction | Protects behavior before structural refactor | Plan |

## Scope

**In scope:**
- Fix B1 catch-up resume path and remove dead branch behavior
- Simplify ID-state semantics around watermark truth
- Add and wire node-level `pageSize` + `maxPagesPerPoll`
- Update/add tests for limits and resume guarantees
- Extract shared lifecycle helpers and adopt in News + Files
- Update suite trigger pattern doc to reference shared helper usage

**Out of scope:**
- Replacing News trigger with `/items/updated`
- Generic cross-app polling engine
- New trigger event types beyond new article IDs
- Broad refactors across Calendar/Deck/Talk

## Architecture / Approach

Three phases: (1) harden News correctness and state rules, (2) parameterize bounded polling controls, (3) extract lifecycle harness (`bootstrap+scrub`, `soft-fail policy`, `manual sample`) into `nodes/shared/pollOrchestration.ts`. Keep polling mechanics that are app-specific (fetch paging, state schema, change detection) in each trigger implementation.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Correctness and ID-state stabilization | B1 fixed, cleaner catch-up/newness semantics | Regressions in resume/watermark edge cases |
| 2. Configurable poll limits | Node params for page size and page cap with defaults 100/5 | Miswiring defaults can change behavior unexpectedly |
| 3. Shared lifecycle extraction | Reusable orchestration helpers used by News and Files | Over-generalization can leak app-specific assumptions |

**Prerequisites:** Current `nextcloud-news` branch state with existing trigger/tests; frame-approved decisions on ID-first model and defaults.  
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Assumes News IDs remain monotonic and suitable as durable newness boundary.
- Lower default page cap may increase time-to-catch-up on very large bursts (but should not skip permanently).
- Existing static data keys must remain backward-compatible across deployed workflows.
- Helper extraction must preserve News one-shot notice policy and Files silent soft-fail policy.

## Success Criteria (Summary)

- No permanent skip/re-fire regressions in News catch-up under bounded polling.
- Node-level limits work with defaults and overrides and are covered by tests.
- Shared lifecycle helper is adopted without changing trigger-specific behavior contracts.
