<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Suite Partial Update

- **Plan**: context/changes/suite-partial-update/plan.md
- **Scope**: Phases 1–6 of 6 (full plan)
- **Date**: 2026-08-01
- **Verdict**: NEEDS ATTENTION → triage complete
- **Findings**: 0 critical 6 warnings 3 observations
- **Triage**: Fixed F2–F7, F9; Skipped F1, F8; F5 fixed after triage (collapse setProp dupes)
- **Prior review**: Phase 1–4 review (same path) was triaged and fixed in `82ca5f5` / `ae7078a`; this full-plan pass does not re-open those findings.
- **Evidence**: Drift agent MATCH on all planned items (1 EXTRA cluster); safety agent 0 CRITICAL on core Update contracts.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success Criteria Evidence

### Automated (re-run 2026-08-01)

| Check | Result |
|-------|--------|
| `npm test` | PASS — 22 files, 274 tests |
| `npm run lint` | PASS |
| Phase 1–6 path/artifact contracts | PASS |
| Card Update whitelist / Move left as-is | PASS |
| No runtime ICS npm deps | PASS |

### Manual (Progress)

All Phase 1–6 Manual checkboxes are `[x]` with commit SHAs. Live loops not re-run in this review (see F9).

## Findings

### F1 — Committed share password in live workflow JSON

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: test/n8n-cli/files/01-share-update-fields.json (~password field)
- **Detail**: Workflow hardcodes `"password": "LiveTestPw1!"`. Credential id/name refs are fine; this is a share-protection secret in git and conflicts with `test/n8n-cli/README.md` (“never commit secrets”).
- **Fix**: Drive password from `$env` / Code node / expression; document env var in `test/n8n-cli/files/README.md`; keep clear-password path as empty string only.
- **Decision**: SKIPPED — accepted as intentional live-test password, not a production secret

### F2 — `isoToIcsDateTime` can emit invalid ICS DATE-TIME

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/dates.ts:71-73
- **Detail**: String-strip conversion mishandles offset forms (`…+02:00` → invalid ICS) and non-ms-3 fractional seconds. Typical n8n `….000Z` works; Create and no-TZID patch paths use this helper.
- **Fix A ⭐ Recommended**: Parse via `Date` / small ISO normalizer; always emit `YYYYMMDDTHHMMSSZ` or floating `YYYYMMDDTHHMMSS`; reject/convert offsets explicitly (same discipline as `isoToFloatingIcsDateTimeInTzid`).
  - Strength: Closes the invalid-ICS class for Create + TZID-less Update.
  - Tradeoff: Needs unit tests for offset / fractional forms.
  - Confidence: HIGH — TZID path already does proper conversion.
  - Blind spot: Whether n8n dateTime widgets ever emit offsets vs always `Z`.
- **Fix B**: Document that Update/Create dateTimes must be `Z` or floating; leave strip helper.
  - Strength: Minimal code change.
  - Tradeoff: Footgun remains for offset ISO strings.
  - Confidence: MEDIUM.
  - Blind spot: Production workflows using offset ISO.
- **Decision**: Fixed via Fix A

### F3 — `webUrl` objectId path segments not re-encoded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/GenericFunctions.ts:297-300
- **Detail**: `userId` / `calendarId` / `eventId` are interpolated decoded while CalDAV builders use `encodeURIComponent`. Users like `user@host` or spaced event stems can produce objectIds that do not match Nextcloud Calendar’s DAV path encoding. Tests cover only simple ids.
- **Fix**: Encode each path segment (and `.ics` filename) the same way as CalDAV URL builders before base64; add tests for `%40` usernames and spaced event ids.
- **Decision**: FIXED

### F4 — Share password policy check fails open

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:598-624; share/update.ts:113-123
- **Detail**: `validateSharePassword` catches all errors and returns `undefined`, so Update Fields password sets proceed if the password_policy OCS endpoint is down. Soft-fail predates this change but is now on the sparse Update path.
- **Fix A ⭐ Recommended**: Distinguish transport/5xx (fail closed or warn) from “endpoint missing” (fail open); or surface a node warning when validation was skipped.
  - Strength: Prevents weak passwords when policy check is unreachable.
  - Tradeoff: May break Updates when policy endpoint is flaky.
  - Confidence: MEDIUM — need to see how Nextcloud signals missing endpoint.
  - Blind spot: Create path shares the same helper.
- **Fix B**: Accept fail-open; document in convention / Files README.
  - Strength: No behavior change; matches historical create path.
  - Tradeoff: Footgun remains.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: Fixed via Fix A

### F5 — `setProp` leaves earlier duplicate ICS properties

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/patchEvent.ts:37-47
- **Detail**: Patch replaces only the *last* property of a given name; earlier duplicates remain. Clients that read the first instance can see stale SUMMARY/etc. while SEQUENCE/DTSTAMP reflect a successful patch. Covered by an existing unit test that documents current behavior.
- **Fix**: On set, remove all properties with that name before inserting the new value (same as `removeProp` semantics).
- **Decision**: FIXED — collapse duplicates on set (completes Phase 1–4 F8)

### F6 — Phase 5 EXTRA: OCS error-message surfacing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: nodes/NextcloudFiles/shared/httpStatus.ts:39-60 (+ ocsRequest, NextcloudFiles.node.ts, tests)
- **Detail**: Phase 5 plan only required Update Fields + sparse PUT + live workflow. Commit `0a2408c` also surfaces OCS validation messages (e.g. past expireDate) via `ignoreHttpStatusErrors` + `formatFilesErrorMessage`. Useful for live verification; not in Changes Required.
- **Fix A ⭐ Recommended**: Document in the plan as an addendum (keep the code).
  - Strength: Same addendum pattern as webUrl / move-smoke / CHANGELOG.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — drift agent confirmed EXTRA cluster only.
  - Blind spot: None significant.
- **Fix B**: Revert error-formatting changes; keep collection UI only.
  - Strength: Strict scope.
  - Tradeoff: Loses clearer expireDate validation errors.
  - Confidence: HIGH.
  - Blind spot: Whether live README assumes clearer messages.
- **Decision**: Fixed via Fix A

### F7 — Convention note omits VTIMEZONE-orphan known limitation

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/update-convention.md (CalDAV section)
- **Detail**: Plan Critical Implementation Details warn that changing timezone may leave an orphan VTIMEZONE; the Phase 6 convention does not. `patchEvent` can attach a new TZID without rewriting VTIMEZONE.
- **Fix**: Add one sentence under CalDAV/CardDAV noting that limitation.
- **Decision**: FIXED

### F8 — ICS parse/serialize unbounded on hostile/huge input

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/parse.ts:65-86; serialize.ts:10-28
- **Detail**: No line/depth/size caps on `parseIcs`; `findFirstVEvent` recurses without depth limit. Risk is mainly pathological calendar-data from an authenticated server, not public input.
- **Fix**: Soft caps (max lines / nesting) with a clear NodeOperationError; optional for Get Many if calendars are large.
- **Decision**: SKIPPED

### F9 — Manual Progress marks not re-verified live in this review

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md ## Progress (Manual subsections)
- **Detail**: All manual rows are `[x]` with phase SHAs; this review confirmed artifacts + automated checks, not live n8n-cli / UI spot-checks.
- **Fix**: Accept prior manual confirmation, or re-run live loops before archive if desired.
- **Decision**: FIXED — accepted prior manual confirmation (no re-run)
