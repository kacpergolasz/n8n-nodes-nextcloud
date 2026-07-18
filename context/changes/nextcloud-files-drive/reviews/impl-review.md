<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Nextcloud Files/Drive node (legacy-standard coverage)

- **Plan**: context/changes/nextcloud-files-drive/plan.md
- **Scope**: Phases 1–2 of 3 (completed phases)
- **Date**: 2026-07-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — OCS envelope accepts sub-400 failure codes as success

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:351
- **Detail**: `unwrapOcsResponse` only throws when `ocs.meta.statuscode >= 400`. Nextcloud OCS uses `100`/`200` for success but also returns failure codes below 400 (e.g. `997` unauthorized, `998` server error, `101` invalid list). These would be returned as success with empty or wrong `ocs.data`. The plan explicitly requires mapping `ocs.meta.statuscode` for share errors.
- **Fix**: Treat only `100` and `200` as success; throw on all other status codes with `ocs.meta.message`.
  - Strength: Matches Nextcloud OCS semantics; prevents silent share failures during Phase 3 smoke.
  - Tradeoff: Minor — one function, a few-line change.
  - Confidence: HIGH — documented OCS status-code convention.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — OCS errors lack status code for execute catch mapping

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:352
- **Detail**: OCS failures throw a plain `Error` without `statusCode`/`httpCode`. The execute catch block uses `getHttpStatusCode(error)` for 404 messaging and `NodeApiError` httpCode — share OCS 404/403 never get that treatment.
- **Fix**: Attach `statusCode: envelope.ocs.meta.statuscode` to the thrown error (same pattern as HTTP errors) so execute reuses status-aware messaging.
- **Decision**: FIXED

### F3 — Unknown resource/operation produces silent no-op

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: nodes/NextcloudFiles/NextcloudFiles.node.ts:89
- **Detail**: If `resource`/`operation` don't match any branch, the try block completes with no output and no error for that item. With three resources and many operations, a typo or future regression could silently drop items.
- **Fix**: Add a final `else` branch that throws `NodeOperationError` for unknown resource/operation combinations.
- **Decision**: FIXED

### F4 — Path normalization does not reject `..` segments

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudFiles/GenericFunctions.ts:33
- **Detail**: `normalizeFilesPath` passes through `..` segments (e.g. `/Documents/../Other/file.pdf`). WebDAV may resolve these outside the intended subdirectory within the authenticated user's tree.
- **Fix A ⭐ Recommended**: Reject paths containing `.` or `..` segments with a clear error before URL construction.
  - Strength: Fail-fast; prevents ambiguous path resolution.
  - Tradeoff: Users cannot intentionally use `..` in paths (unlikely for Nextcloud workflows).
  - Confidence: HIGH — common WebDAV client pattern.
  - Blind spot: None significant.
- **Fix B**: Resolve `..` segments to canonical paths before encoding.
  - Strength: More permissive for power users.
  - Tradeoff: More complex; edge cases around root traversal.
  - Confidence: MEDIUM — resolution logic must be bulletproof.
  - Blind spot: Unicode/normalization edge cases.
- **Decision**: FIXED (Fix A)

### F5 — README omits Share resource after Phase 2

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: README.md:31
- **Detail**: README "What's Included" lists Files as "WebDAV file and folder" ops only; Share CRUD (Phase 2) is not mentioned. Phase 2 did not require a README update, but docs are now stale.
- **Fix**: Add Share operations to the Nextcloud Files README line.
- **Decision**: FIXED

### F6 — shareId defaults to 0 for update/delete

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: nodes/NextcloudFiles/shared/descriptions.ts:66
- **Detail**: `shareId` field defaults to `0`. Update/delete without an explicit ID will target share ID 0.
- **Fix**: Validate `shareId > 0` before update/delete API calls; consider removing the numeric default.
- **Decision**: FIXED (removed numeric default + validation)

### F7 — Share Get Many applies limit client-side only

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: nodes/NextcloudFiles/NextcloudFiles.node.ts:328
- **Detail**: Get Many fetches the full share list from OCS, then slices client-side. Large accounts pay full fetch cost even when `returnAll` is false. Acceptable for MVP per plan performance notes.
- **Fix**: Document the limitation; defer server-side paging unless OCS adds filter params.
- **Decision**: FIXED
