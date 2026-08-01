<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Suite Partial Update

- **Plan**: context/changes/suite-partial-update/plan.md
- **Scope**: Phases 1–4 of 6 (completed phases only)
- **Date**: 2026-08-01
- **Verdict**: NEEDS ATTENTION → triage complete (all findings addressed)
- **Findings**: 0 critical 6 warnings 3 observations
- **Triage**: Fixed F1–F9 (see Decisions below)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success Criteria Evidence

### Automated (re-run 2026-08-01)

| Check | Result |
|-------|--------|
| `npm test` | PASS — 21 files, 261 tests |
| `npm run lint` | PASS |
| Phase 1 paths (`test/n8n-cli/README.md`, deck/calendar/files) | PASS |
| Phase 2 deck workflow + README | PASS |
| Phase 3 ICS module + create serializer + roundtrip tests | PASS |
| Phase 4 patch tests + workflows 02/03 + faker + generator | PASS |

### Manual (Progress)

All Phase 1–4 Manual checkboxes are `[x]` with commit SHAs (`c7d691d` … `fcce8c6`). Observable artifacts (webhook workflows, READMEs, Progress SHAs) support the marks; live `execution get` results were not re-run in this review.

## Findings

### F1 — UTC `Z` datetimes rewritten as TZID floating wall-clock

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/patchEvent.ts:101-106, dates.ts:94-96
- **Detail**: When an existing VEVENT has `TZID` and Update Fields supplies ISO datetimes with `Z` (typical n8n `dateTime`), the patch keeps TZID and strips `Z` via `isoToFloatingIcsDateTime`, treating UTC digits as local wall time. Live workflow `test/n8n-cli/calendar/03-sequence-and-times.json` uses `2031-03-20T09:00:00Z` against a TZID fixture — same path.
- **Fix A ⭐ Recommended**: When input is UTC (`Z`), convert to wall-clock in the preserved TZID before writing floating DATE-TIME (or document that Update Fields times are TZID-local and stop emitting `Z` in fixtures).
  - Strength: Keeps intentional TZID events correct for operators in that zone.
  - Tradeoff: Needs a timezone conversion dependency or careful Intl/`Temporal` handling; more code.
  - Confidence: MEDIUM — conversion correctness across DST edges needs tests.
  - Blind spot: Whether n8n dateTime widgets always emit `Z` even for "local" intent.
- **Fix B**: When input ends with `Z`, emit UTC DATE-TIME and drop TZID on DTSTART/DTEND.
  - Strength: Simple; matches literal UTC semantics of the ISO string.
  - Tradeoff: Changing times on a TZID event may silently clear TZID / orphan VTIMEZONE.
  - Confidence: HIGH — mechanical rule.
  - Blind spot: Operators who meant "09:00 in Europe/Warsaw" but got `Z` from the UI.
- **Decision**: Fixed via Fix A

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/resources/event/update.ts:48-49, ics/patchEvent.ts:199-201
- **Detail**: UI description says leave Timezone unset to keep current TZ, but adding the field with default `''` sets `patch.timezone !== undefined`, trims to empty → `nextTzid = undefined`, and rebuilds DTSTART/DTEND without TZID.
- **Fix A ⭐ Recommended**: Treat empty/whitespace timezone as omit-from-patch (same as unset).
  - Strength: Matches UI copy; prevents accidental TZID wipe.
  - Tradeoff: No way to clear TZID via empty string (must use all-day or explicit UTC path).
  - Confidence: HIGH — aligns description with behavior.
  - Blind spot: Whether any workflow relies on empty string to clear TZID.
- **Fix B**: Keep clear-on-empty; fix UI description to say empty clears timezone.
  - Strength: Minimal code change.
  - Tradeoff: Footgun remains for collection defaults.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: Fixed via Fix A

### F3 — `DURATION`-only events fail date/timezone/all-day patches

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/patchEvent.ts:206-213
- **Detail**: Date-touch path requires both DTSTART and DTEND. Events that use `DURATION` instead of `DTEND` throw and abort Update (summary-only still works).
- **Fix A ⭐ Recommended**: When DTEND is missing, resolve end from DTSTART + DURATION (or write DTEND and remove DURATION on date edits).
  - Strength: Handles a common CalDAV shape without failing the whole Update.
  - Tradeoff: Duration parsing + RRULE interaction edge cases.
  - Confidence: MEDIUM — need fixture coverage for DURATION formats.
  - Blind spot: Whether Nextcloud Calendar itself always emits DTEND.
- **Fix B**: Keep hard fail; throw a clear NodeOperationError naming DURATION.
  - Strength: Explicit; no silent semantics change.
  - Tradeoff: Operators cannot change times on DURATION events until they add End.
  - Confidence: HIGH.
  - Blind spot: Prevalence of DURATION on target instances.
- **Decision**: Fixed via Fix B

### F4 — Non-whitelist `updateFields` keys bypass empty-collection guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/resources/event/update.ts:21-52
- **Detail**: Empty `{}` is rejected, but e.g. `{ unknown: 1 }` passes `Object.keys(raw).length === 0`, builds an empty `EventUpdatePatch`, then still GET→patch→PUT (DTSTAMP-only write). Diverges from Files' empty-selection check after mapping.
- **Fix**: After mapping whitelist keys, if `Object.keys(patch).length === 0`, throw the same “Select at least one field…” error.
- **Decision**: FIXED

### F5 — Deck card PUT whitelist includes unplanned `owner`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudDeck/GenericFunctions.ts:440-451
- **Detail**: Plan contract listed only `title`, `description`, `duedate`, `type`, `order`. Implementation always adds `owner` coerced from GET (`resolveCardOwnerUid`) because Deck requires it. Nested labels/assignees still excluded; `moveCard` untouched. Tests expect `owner`.
- **Fix**: Document `owner` as a required coerced scalar in the plan whitelist (and any follow-up convention note) — do not remove it from the PUT body.
- **Decision**: FIXED (plan addendum — documented `owner`)

### F6 — Unplanned Calendar `webUrl` deep links

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: nodes/NextcloudCalendar/GenericFunctions.ts:280-301; create/get/getAll/update return paths; CHANGELOG.md:15
- **Detail**: Phase 4 commit added `buildCalendarEventWebUrl` and wired `webUrl` into Create / Get / Get Many / Update. Helpful UX, documented in CHANGELOG, but not in plan Changes Required.
- **Fix A ⭐ Recommended**: Document in the plan as an addendum (and keep the feature).
  - Strength: Preserves useful work; plan stays source of truth for later phases/reviews.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — already in CHANGELOG.
  - Blind spot: URL shape correctness across Nextcloud versions/apps.
- **Fix B**: Remove `webUrl` and defer to a follow-up change.
  - Strength: Strict scope discipline.
  - Tradeoff: Loses shipped UX; another PR later.
  - Confidence: HIGH.
  - Blind spot: Callers already depending on `webUrl` in workflows.
- **Decision**: Fixed via Fix A (plan addendum — keep webUrl)

### F7 — Edited SUMMARY/DESCRIPTION/LOCATION drop property params

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/patchEvent.ts:143-178
- **Detail**: `setProp` replaces edited text properties with `params: []`, so `LANGUAGE` / `ALTREP` on those properties are lost. Component-level preserve-unknown (RRULE/ATTENDEE/VALARM) remains intact.
- **Fix**: Preserve existing params when updating value (drop only conflicting ones when intentionally changing mode).
- **Decision**: FIXED

### F8 — `setProp` updates first duplicate; change detection reads last

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudCalendar/ics/patchEvent.ts:28-44
- **Detail**: `lastProp` walks to the last match; `setProp` uses `findIndex` (first). Rare duplicate ICS properties could leave values inconsistent.
- **Fix**: Align both on last-index replace (or collapse duplicates on write).
- **Decision**: FIXED

### F9 — Benign extras: CHANGELOG + Deck move-smoke workflow

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: CHANGELOG.md; test/n8n-cli/deck/02-move-smoke.json
- **Detail**: CHANGELOG Unreleased notes and `02-move-smoke.json` were not listed under Changes Required. Move smoke supports Progress criterion 2.6; CHANGELOG is standard release hygiene.
- **Fix**: Keep; optionally note both as intentional extras in the plan addendum with F5/F6.
- **Decision**: FIXED (plan addendum — keep CHANGELOG + move-smoke)
