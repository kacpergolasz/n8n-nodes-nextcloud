# Frame Brief: Solid News Poll Trigger as Suite Reference

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

The Nextcloud News poll trigger is being built as the reference example for
future suite app triggers (Calendar, Deck, Talk). After several fixes and a
catch-up remodel, most tracked issues in `pollNews-issues.md` are closed, but
B1 (peek `exhausted` clears pending catch-up) remains open. The goal is a
**solid way to create poll triggers for News** — reliable enough to ship and
reusable enough to guide future apps.

## Initial Framing (preserved)

- **User's stated cause or approach**: The remaining work is mainly about
  finishing correctness in `pollNews.ts` (especially the peek/resume catch-up
  model) so the trigger is reliable enough to ship and document as the suite
  pattern.
- **User's proposed direction**: Land a solid poll-trigger approach for News —
  likely by closing the open issue(s) and crystallizing the pattern in suite
  docs (`next-app-triggers.md`).
- **Pre-dispatch narrowing**: Both correctness gaps and pattern extractability
  are leading concerns — finish correctness first, then extract/document the
  pattern for future apps.
- **Post-dispatch narrowing (detection model)**: Chosen direction — keep
  monotonic-id detection, remove `lastModified` dependency in trigger logic,
  and simplify state to a `lastIdRead` watermark (plus optional resume cursor
  when page budget is hit).
- **Post-dispatch narrowing (reference deliverable)**: Both, sequentially —
  finish News correctly first, then extract a shared poll orchestration harness
  from the proven implementation.

## Dimension Map

The observation could originate at any of these dimensions:

1. **State-model correctness** — the peek/resume/watermark catch-up model
   still has gaps (B1 open; remodel addressed most others) ← initial framing
2. **Excessive state complexity** — watermark + ring buffer + catchUpOffset
   triad creates interaction bugs; complexity itself generates defects
3. **API-layer mismatch** — `GET /items` offset paging forces a ~550-line state
   machine; News API v1.3 offers `GET /items/updated?lastModified=…` for
   ongoing sync but the trigger doesn't use it
4. **Pattern extractability** — even if correct, `pollNews.ts` (~678 lines,
   ~80% News-specific) isn't copyable; no shared poll harness exists beyond
   `pollHelpers.ts` (95 lines of cursor/ID-window utilities)

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **Correctness gaps beyond B1** | B1 is the only open bug; P6 (peek budget exhausted, resume preserved) is untested but behavior is correct; line 481–482 is dead code, not a defect. Seven catch-up edge cases covered in tests. | **WEAK** — remodel is sound; B1 is the sole correctness gap |
| **State complexity (watermark/ring/catchUp triad)** | 5 of 12 issues (B1, B3, B4, B5, B8) are state-interaction bugs. Ring buffer added to fix B8; catchUp added for IR-F3; interactions between the three created most high-severity defects. Ring buffer theoretically eliminable given monotonic ids (`pollNews.ts:57–59`). | **STRONG** — complexity is a root contributor, not just a symptom |
| **API mismatch (`GET /items` vs `/items/updated`)** | Research documents upstream-recommended ongoing sync via `/items/updated` (`research.md:78,131`). Trigger uses only `GET /items` + offset walk. Direct API-cursor bugs: B7, B6, IR-F3. Six more bugs wouldn't exist with timestamp-based sync. Plan chose "new ids only" + offset paging intentionally (`plan.md:19`). | **STRONG** — but intentionally chosen; not an accident |
| **Pattern extractability** | Files trigger (235 lines, snapshot diff) and News trigger (678 lines, ID-window + catch-up) share zero orchestration code — only `pollHelpers` utilities. `next-app-triggers.md` describes prose conventions, not reusable abstractions. ~500 lines of News-specific machinery with no separation from generic poll shell. | **STRONG** — reference today is prose + copy-paste, not a harness |

## Narrowing Signals

- User wants **both** correctness and pattern work, **sequentially** — not
  either/or.
- User chose **ID-based detection** over `lastModified`/`createdAt` framing:
  treat monotonic article id as source of truth for "new article."
- Initial framing (fix B1 + document) is **necessary but insufficient** for
  "solid way to create poll triggers" — extractability findings confirm the
  gap is structural, not just one bug.
- User requested poll-burst controls exposed at node level: configurable
  **maximum page size** (default `100`) and **maximum pages per poll**
  (default `5`).

## Cross-System Convention

Suite polling triggers follow a shared **conceptual** skeleton documented in
`next-app-triggers.md`: init gate (no history flood), soft-fail after init,
manual one-sample test step, `pollHelpers` cursor utilities. But detection models
**legitimately differ per app**:

- **Files**: snapshot diff on etag/lastModified (no pagination)
- **News**: ID-window + monotonic watermark + paginated catch-up (plan: "new
  ids only")
- **Calendar** (planned): time-window + lastModified when S-08 lands
- **Deck** (planned): ID dedupe until timestamps exist

The suite explicitly positions News as the reference for **ID-window + scope
filters** (`next-app-triggers.md:74`), not timestamp-based sync. That aligns
with the plan's offset-paging choice and shared `pagination.ts` reuse — but
it also means the complexity cost is baked into the reference role unless
extracted or simplified.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: News poll trigger correctness is
> nearly complete (B1 + test gaps remain), but "solid reference for future apps"
> requires two sequential deliverables — not just closing bugs.

First, **finish and harden** a simplified monotonic-id model (fix B1, remove
ring-buffer dependence for newness decisions, add missing test coverage, verify
no regressions). Second, **extract the generic
poll orchestration shell** (init gate, scope-change detection, soft-fail
envelope, manual sample, credential load) into shared code that future triggers
plug app-specific detection into.

The initial framing was **partially correct** — B1 must be fixed — but
under-scoped the "solid reference" goal. The trigger today is a working
**example**, not a **template**. ~80% of `pollNews.ts` is News-specific
detection logic interleaved with generic poll mechanics that Files duplicates
independently.

Design gate is now narrowed: keep ID-based detection and simplify around
`lastIdRead` as the only durable "seen" truth. `GET /items/updated` stays out
of scope for this change unless the simplified ID model proves insufficient.

## Confidence

**MEDIUM**

- **Strong** on: B1 as sole open correctness bug; extractability gap; state/API
  complexity as contributors to bug history.
- **Weaker** on: exact simplification boundary (how much ring-buffer behavior
  to keep only for in-poll overlap dedupe) and migration safety.
- **Verification needed before /10x-plan implementation details**: confirm
  burst handling under configurable limits (`pageSize=100`, `maxPagesPerPoll=5`
  defaults) still guarantees no permanent skips across polls.

## What Changes for /10x-plan

The plan should have **three phases**, not one bug fix:

1. **Close correctness** — fix B1 (don't clear catch-up on peek `exhausted`
   when `priorOffset` is set), add P6 test, remove dead code at 481–482.
2. **Simplify state + expose limits** — center newness on `lastIdRead`
   (`maxProcessedId`), minimize ring-buffer role, and add node-configurable
   poll controls:
   - maximum page size (default `100`)
   - maximum pages per poll (default `5`)
3. **Extract harness** — after (1) and (2), pull generic poll orchestration
   from News (+ Files commonalities) into `nodes/shared/`; update
   `next-app-triggers.md` to reference code, not just prose.
Phase 3 should extract from this leaner, ID-first News trigger so future app
triggers inherit bounded polling controls and a smaller state surface.

## References

- Source files: `nodes/NextcloudNewsTrigger/pollNews.ts`, `nodes/shared/pollHelpers.ts`, `nodes/shared/pagination.ts`, `nodes/NextcloudFilesTrigger/pollDirectory.ts`
- Issues inventory: `nodes/NextcloudNewsTrigger/pollNews-issues.md`
- Suite pattern doc: `context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md`
- Plan constraint: `context/changes/nextcloud-news/plan.md:19` ("new ids only")
- API sync model: `context/changes/nextcloud-news/research.md:78,131`
- Investigation tasks: state correctness (7f66f730), state complexity (5f84660e), API mismatch (8022b644), pattern extractability (c3f77257)
