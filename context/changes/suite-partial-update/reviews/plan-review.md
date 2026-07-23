<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Suite Partial Update

- **Plan**: `context/changes/suite-partial-update/plan.md`
- **Mode**: Deep
- **Date**: 2026-07-23
- **Verdict**: SOUND (after triage)
- **Findings**: 1 critical, 3 warnings, 1 observation — all triaged

## Verdicts

| Dimension | Verdict (post-triage) |
|-----------|------------------------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS (F1 fixed) |
| Plan Completeness | PASS (F2–F5 fixed) |

## Grounding

11/11 existing paths ✓, symbols ✓, brief↔plan fixed (F5). Root `test/` did not exist yet — `test/n8n-cli/` is a create. Progress↔Phase mapping consistent after edits.

## Findings

### F1 — n8n-cli cannot start workflow executions

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 tradition; Phases 2–5 Manual “n8n-cli … execute”
- **Detail**: `@n8n/cli` 0.11.0 exposes workflow create/update/get/activate and execution list/get/retry/stop/delete — no run/execute. Later phases required “execute via n8n-cli”, which is impossible with the CLI alone.
- **Fix A ⭐ Recommended**: Hybrid tradition — CLI owns create/update/get/activate + execution inspect; start runs via Webhook trigger + curl; Manual Execute in UI as fallback
- **Fix B**: CLI = publish artifacts only; human runs in editor; CLI only `execution get`
- **Decision**: FIXED via Fix A — plan Critical Details, Phase 1–5 contracts/success criteria, Progress, brief, and change.md updated for hybrid Webhook+curl model

### F2 — Empty Calendar Update Fields policy is unresolved

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Event Update execute path
- **Detail**: Contract hedged “clear error (or no-op — prefer error)”.
- **Fix**: Lock empty Update Fields → `NodeOperationError` (same as Files empty `fieldsToUpdate`)
- **Decision**: FIXED

### F3 — Create `location` left as TBD; Update requires it

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Create migration; Phase 4 Update Fields
- **Detail**: Create UI had no `location`; Phase 3 hedged; Phase 4 Update Fields includes location. Type already has `location?: string`.
- **Fix A ⭐ Recommended**: Add optional Create `location` in Phase 3 when migrating the serializer
- **Fix B**: Update-only location
- **Decision**: FIXED via Fix A

### F4 — Phase 4 “rich ICS” live fixtures under-specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 live workflows / Manual 4.5
- **Detail**: Success needs RRULE/ATTENDEE/VALARM survival, but node Create only emits minimal VEVENTs. Seeding path was vague.
- **Fix A ⭐ Recommended**: Checked-in rich `.ics` fixture + CalDAV seed steps
- **Fix B**: Narrow Manual 4.5 to Create-producible props; unit tests for RRULE/VALARM
- **Decision**: FIXED differently — `@faker-js/faker` as devDependency + generative rich ICS (structural template + faker-filled fields); Progress `4.8` added

### F5 — Brief diagram implies Update Fields for Deck too

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan-brief.md` Architecture
- **Detail**: Diagram rooted all paths under Update Fields collection; Phase 2 keeps Deck flat empty-means-keep UI.
- **Fix**: Adjust brief diagram — Deck flat optional fields; collection is Calendar + Files
- **Decision**: FIXED

## Triage Summary

| ID | Decision |
|----|----------|
| F1 | FIXED via Fix A (hybrid Webhook+curl) |
| F2 | FIXED |
| F3 | FIXED via Fix A |
| F4 | FIXED differently (faker generative fixtures) |
| F5 | FIXED |

**Verdict after fixes: SOUND**
