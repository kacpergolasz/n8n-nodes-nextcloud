<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Suite Polling Triggers

- **Plan**: context/changes/suite-polling-triggers/plan.md
- **Scope**: Phases 1–6 of 6 (full plan)
- **Date**: 2026-07-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 2 observations

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

### F1 — Follow-up checklist still says manual empty throws

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/suite-polling-triggers/follow-ups/next-app-triggers.md:14
- **Detail**: Intentional late fix returns `null` when Test step has no sample (avoids n8n cron deregistration). Code and poll tests match that. Follow-ups still say “throw a scrubbed error if nothing to show”; plan Implementation Approach / Phase 4–5 contracts still say throw. Future Calendar/Deck triggers may copy the stale rule.
- **Fix**: Update follow-ups (and optionally plan wording) to “return `null` if nothing to show” and note why (poll/cron teardown risk).
- **Decision**: FIXED — updated follow-ups to return null (no throw) on empty manual sample

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFilesTrigger/pollDirectory.ts:174
- **Detail**: Soft-fail only applies when `loadDirectoryListing` throws. A successful response with `[]` (or an unexpectedly empty parse) still calls `setSnapshot(..., buildSnapshotFromListing(listing))`, wiping prior paths. The next non-empty listing classifies every child as created.
- **Fix A ⭐ Recommended**: If prior snapshot had entries and the new listing is empty (or shrinks by a large factor), keep the previous snapshot, log debug, return `null` (treat as soft-fail / suspicious listing).
  - Strength: Prevents create floods from transient empty listings without changing happy-path create/update.
  - Tradeoff: A real “user emptied the folder” case delays until a later non-empty listing; deletes remain out of scope anyway.
  - Confidence: HIGH — mirrors soft-fail intent already in the plan.
  - Blind spot: Have not verified how often WebDAV returns empty multistatus on transient faults.
- **Fix B**: Document the risk only in follow-ups / open risks; leave code as-is for S-07.
  - Strength: No behavior change; ships as verified.
  - Tradeoff: Flood risk remains for empty successful listings.
  - Confidence: MEDIUM — depends how often Nextcloud returns empty success incorrectly.
  - Blind spot: Production frequency unknown.
- **Decision**: FIXED via Fix A — keep prior snapshot on empty post-init listing; added poll test

### F3 — Soft-fail scrubbing not asserted in poll tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFilesTrigger/test/NextcloudFilesTrigger.poll.test.ts:192-203
- **Detail**: Production soft-fail uses `scrubErrorMessage(error, credentials)` before `logger.debug`. The soft-fail test rejects with a message containing `secret-token` but only asserts `stringContaining('soft-failing poll')`, not that the password is absent.
- **Fix**: Assert the debug argument does `not.stringContaining('secret-token')` (and optionally contains `[REDACTED]` if that is scrubSecrets’ marker).
- **Decision**: FIXED — assert soft-fail debug log redacts secret-token

### F4 — Unbounded Depth-1 listing / snapshot size

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFilesTrigger/pollDirectory.ts:136-138
- **Detail**: Plan Performance Considerations already note large directories as out of scope. Poll path has no `LIST_SEARCH_MAX_ENTRIES`-style cap (folder picker does). Acceptable for S-07; worth tracking for a later limit/warn.
- **Fix**: Record as follow-up only; no code change required for this review.
- **Decision**: FIXED — noted large-folder cap as deferred follow-up in next-app-triggers.md

### F5 — Init/soft-fail gated on `lastTimeChecked` vs plan “empty snapshot”

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudFilesTrigger/pollDirectory.ts:134
- **Detail**: Plan wording says empty/existing snapshot; implementation uses `getLastTimeChecked !== undefined`. Seed writes both together, so happy path is equivalent. Edge case: cursor present without snapshot would skip re-seed.
- **Fix**: Accept as equivalent, or document the cursor-as-init-gate convention in follow-ups.
- **Decision**: FIXED — documented cursor-as-init-gate in next-app-triggers.md
