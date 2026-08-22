<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Suite API client + repository refactor

- **Plan**: context/changes/refactor-current-apis/plan.md
- **Scope**: Phases 0–2 of 4 (completed phases only)
- **Date**: 2026-08-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — overwriteField UI description changed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: nodes/NextcloudFiles/shared/descriptions.ts:44
- **Detail**: Plan “What We’re NOT Doing” forbids changing node UI property descriptions. Phase 2 rewrote `overwriteField.description` to mention 412 / COPY-MOVE behavior. Related 412 error-mapping in `NextcloudFiles.node.ts` / `httpStatus.ts` is separate (error plumbing, not a property description).
- **Fix**: Revert `overwriteField.description` to the prior one-liner (keep httpCode/412 node error handling if desired).
- **Decision**: SKIPPED

### F2 — Files GenericFunctions still re-exports response parsers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:60
- **Detail**: Plan 2.4 required removing response parsers from GenericFunctions once migrated. HTTP helpers (`nextcloudRequest` / `ocsRequest`) are gone and resources use repositories, but GF still re-exports `parseShare`, `parseDirectoryListingFromMultistatus`, `unwrapOcsResponse`, etc. Callers include `ocs.test.ts` and convenience barrels.
- **Fix A ⭐ Recommended**: Stop re-exporting parsers from GenericFunctions; point tests/callers at repository modules directly; document any intentional barrel in the plan addendum.
  - Strength: Matches plan 2.4 contract and clears the dual import surface.
  - Tradeoff: Touch `ocs.test.ts` and any GF importer paths.
  - Confidence: HIGH — repos already export these symbols.
  - Blind spot: FilesTrigger or other packages importing parsers via GF (Phase 4 still uses `loadDirectoryListing`, not parsers).
- **Fix B**: Document as intentional compatibility barrel in a plan addendum and leave exports.
  - Strength: Zero code churn; tests keep working.
  - Tradeoff: Plan ground truth stays fuzzy for future reviews.
  - Confidence: MEDIUM — only justified if multiple external importers exist.
  - Blind spot: Haven’t grepped the whole monorepo outside this package.
- **Decision**: FIXED via Fix A

### F3 — renameFolder soft-succeeds when schema parse fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNews/repositories/NewsFolder.repository.ts:79
- **Detail**: After PUT, if list and single-folder Zod parses both fail, `renameFolder` returns `{ success: true, response: null }` instead of the parse error. Deck repositories do not soft-succeed on parse failure; this can hide API/schema drift.
- **Fix**: On parse failure when a body is present, return the failed `Maybe` (or last parse error); reserve `null` only for empty/`undefined` bodies.
- **Decision**: FIXED

### F4 — ocs.test.ts not migrated onto repository test module

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: nodes/NextcloudFiles/test/ocs.test.ts:1
- **Detail**: Plan 2.5 asked to migrate relevant cases from `GenericFunctions.test.ts` and `ocs.test.ts` into client/repository tests. `FilesShare.repository.test.ts` covers some parse/list/create cases, but `ocs.test.ts` remains a full suite — incomplete migration / dual homes. (Parser imports already pointed at the repository after F2.)
- **Fix**: Move remaining OCS helper assertions into `FilesShare.repository.test.ts` (or a repo-adjacent test) and delete or shrink `ocs.test.ts`.
- **Decision**: FIXED

### F5 — Share password validation treats malformed success bodies as OK

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFiles/repositories/FilesShare.repository.ts:326
- **Detail**: `parseSharePasswordValidationResult` returns `undefined` (accept) when the HTTP call succeeded but the body is non-OCS, meta fails parse, or `passed` is missing — not only when `passed === true`. Fail-open on 404/405/501 for a missing policy app is documented; fail-open on malformed success is subtler. Likely behavior preserved during the move into the repository.
- **Fix**: Accept only when `passed === true`; keep documented fail-open solely for missing-app status codes.
- **Decision**: ACCEPTED-AS-RULE: Password-policy validate: parse outcome vs policy verdict

### F6 — filesPaths / httpStatus extraction beyond plan file list

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: nodes/NextcloudFiles/shared/filesPaths.ts:1
- **Detail**: Path helpers were extracted to `shared/filesPaths.ts` and 412/`httpCodeForNodeApiError` landed in `shared/httpStatus.ts` + node error path. Supports slim GenericFunctions and better overwrite errors; not listed as named deliverables but aligns with Phase 2 intent.
- **Fix**: Add a short plan addendum noting the extraction and 412 error-mapping so future reviews treat them as in-scope.
- **Decision**: FIXED

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudNews/repositories/NewsFolder.repository.ts:1
- **Detail**: News repository schemas allow unknown fields (Zod strips by default); Deck uses `.strict()`. More resilient to API extras, but diverges from the Deck reference pattern and leaves dual shapes vs `NewsInterface.ts`.
- **Fix**: Document as intentional News resilience, or add `.strict()` / re-export `z.infer` types as the canonical News shapes.
- **Decision**: FIXED (convention: no `.passthrough()`; `.strict()` only if absolutely necessary; News already matches — documented in plan addendum + lessons.md)
