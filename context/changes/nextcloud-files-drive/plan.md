# Nextcloud Files/Drive Node Implementation Plan

## Overview

Implement roadmap S-03 (FR-004): a vertical **Nextcloud Files** app node that automates Nextcloud Files/Drive at legacy-standard coverage — file, folder, and share operations — on top of the shared `nextcloudApi` Basic Auth credential established in S-01. The node mirrors the Google Drive slot in the n8n panel (one app node, multiple resources), reuses the proven S-01 patterns (programmatic `execute`, `resourceLocator` + `listSearch` pickers, secret scrubbing, Vitest), and adds no new credential.

## Current State Analysis

`packages/nextcloud/` currently ships exactly one suite node — **Nextcloud Calendar** — plus the shared `nextcloudApi` credential (`baseUrl` / `username` / `appPassword`, `/status.php` test). `package.json` registers only `NextcloudApi` credential + `NextcloudCalendar` node; Vitest and `tsconfig` test-exclusion are already wired from S-01. There is **no** Files/Drive node yet, so the "thin core file surface" pain (PRD Vision) is unaddressed in this package.

The Calendar node is the template to mirror:
- Programmatic `NextcloudCalendar.node.ts` with `credentials: [{ name: 'nextcloudApi', required: true }]`, a single `resource` dropdown, and per-resource description modules.
- CalDAV verbs (`PROPFIND`) are handled by widening `IHttpRequestMethods` with a local method union and calling `helpers.httpRequestWithAuthentication` — the same technique Files needs for `MKCOL` / `MOVE` / `COPY` / `PROPFIND`.
- FR-011 pickers use `resourceLocator` (`list` + manual `id`) with a `listSearch` method (`getCalendars`) that PROPFINDs the DAV home and parses the multistatus XML.
- Every catch path scrubs `appPassword` / Basic-auth material via `shared/scrubSecrets.ts` and derives a status code via `shared/httpStatus.ts`; `continueOnFail` returns a scrubbed error item, otherwise a `NodeApiError` is thrown.

### Key Discoveries:

- Shared credential is ready to reuse verbatim: `credentials/NextcloudApi.credentials.ts` (`nextcloudApi`) — no changes needed (`nodes/NextcloudCalendar/NextcloudCalendar.node.ts:66`).
- WebDAV file root is `{{baseUrl}}/remote.php/dav/files/{username}/{path}`; upload=`PUT`, download=`GET`, delete=`DELETE`, folder create=`MKCOL`, move=`MOVE`+`Destination` header, copy=`COPY`+`Destination` header, list=`PROPFIND` `Depth: 1` (Nextcloud dev docs, WebDAV/basic).
- OCS sharing is `{{baseUrl}}/ocs/v2.php/apps/files_sharing/api/v1/shares` — `POST` create, `GET` list, `PUT /{id}` update, `DELETE /{id}` delete. Requires the `OCS-APIRequest: true` header; request JSON with `?format=json` and parse `ocs.data`. `shareType` (0 user / 1 group / 3 public link / 4 email …), `permissions` bitmask (1 read / 2 update / 4 create / 8 delete / 16 share / 31 all), `publicUpload`, `password`, `expireDate` (Nextcloud dev docs, OCS ocs-share-api).
- The method-union trick, scrubbing, and `httpStatus` helper are small and generic; S-01 keeps them inside the Calendar node folder rather than a package-level `shared/`.
- Vitest + `tsconfig` test exclusion already exist (`package.json:24`, S-01 Phase 2) — new tests drop in with zero config changes.
- Binary handling: n8n exposes `getBinaryDataBuffer` (upload) and `prepareBinaryData` (download) — the idiomatic path core n8n's Nextcloud node uses.

## Desired End State

A workflow author searches "nextcloud" in the node panel, picks **Nextcloud Files** (alongside Nextcloud Calendar), attaches the same shared Nextcloud API credential, and can:
- **File**: Upload (from a binary property), Download (to a binary property), Delete, Move, Copy.
- **Folder**: Create, Delete, List (contents as items), Move, Copy.
- **Share**: Create (user/group/public link with permissions/password/expiry), Get Many, Update, Delete — public-link create returns the share URL/token.
- Pick the target file/folder path from a loaded list (browse a directory level) **or** type a path manually (FR-011).

All operations produce useful workflow items, `appPassword` never appears in outputs or error messages, `continueOnFail` yields scrubbed error items, and `npm run build && npm run lint && npm test` all pass. The package registers `NextcloudApi` + `NextcloudCalendar` + `NextcloudFiles`.

### Key Discoveries:

- No credential or test-runner work is needed — this slice is purely a new node tree + registration.
- Files listing is per-directory (`PROPFIND Depth: 1`), so the `listSearch` picker naturally browses one folder level; deep tree browse is out of scope.
- OCS returns XML by default; forcing JSON (`format=json` + `Accept: application/json`) keeps parsing simple and avoids a second XML parser.

## What We're NOT Doing

- OAuth2 credential (S-02) — Basic Auth `nextcloudApi` only.
- Other suite apps: Deck (S-04), Talk (S-05), News (S-06).
- Polling/webhook triggers (S-07 / FR-009 / FR-010).
- Drive v2 parity stretch: chunked/large-file upload, versions, trashbin, tags, comments, favorites, full-text search, activity.
- OCS **user/group provisioning** and any admin-only endpoints (core n8n's Nextcloud "User" resource) — not Files/Drive.
- Federated/circle/Talk-conversation share types beyond the standard user / group / public-link / email set (create supports the standard set; exotic `shareType`s are not surfaced as first-class UI).
- Live Nextcloud integration tests in CI (manual Phase 3 is the proof).
- Refactoring Calendar's helpers into a package-level shared module (a later DRY slice may do this).
- npm publish / package rename.
- README full rewrite (only a one-line "What's Included" touch to add Nextcloud Files).

## Implementation Approach

Mirror the S-01 Calendar node structure under `nodes/NextcloudFiles/`, delivered in two build phases plus a verification gate:

1. **WebDAV file & folder operations + pickers** — stand up the node scaffold, port the generic helpers (credential load, request wrapper with a widened method union, scrubbing, http-status), implement file + folder operations over WebDAV, wire `resourceLocator` path fields with a `listSearch` browse method (FR-011), and register the node. Unit-test the pure helpers.
2. **Sharing via OCS** — add the `share` resource and OCS request helper (JSON + `OCS-APIRequest` header), implement create/get-many/update/delete, and unit-test the OCS response parser.
3. **North-star local verification** — human runs the F-01 link path against a real Nextcloud and exercises every operation, both picker modes, binary round-trips, and the secret-scrub guardrail.

Source of truth for structure: `nodes/NextcloudCalendar/`. Source of truth for endpoints: Nextcloud developer docs (WebDAV/basic, OCS ocs-share-api), with zahidcoder used only as an endpoint cross-check.

## Critical Implementation Details

- **WebDAV verbs & typing** — `IHttpRequestMethods` omits `PROPFIND` / `MKCOL` / `MOVE` / `COPY`. Reuse Calendar's approach: declare a local `NextcloudHttpMethod = IHttpRequestMethods | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY'` union and cast at the `httpRequestWithAuthentication` boundary. `MOVE`/`COPY` send an absolute `Destination` header (full `remote.php/dav/files/…` URL, URL-encoded per segment) plus `Overwrite: 'T'|'F'`.
- **Path encoding** — build WebDAV URLs as `{base}/remote.php/dav/files/{encodeURIComponent(username)}/{path}` where each path segment is individually `encodeURIComponent`'d (never encode the slashes). A single builder must be shared by file ops, folder ops, the folder List operation, and the `listSearch` picker so encoding can't drift.
- **OCS request contract** — OCS calls need header `OCS-APIRequest: true` and `?format=json`; parse the `ocs.data` envelope. A non-2xx OCS `meta.statuscode` (e.g. 404 "file couldn't be shared") can still arrive inside a 200 HTTP body, so map both HTTP status and `ocs.meta.statuscode` when building error messages. `permissions` is a bitmask; expose it as a friendly multi-select (Read/Update/Create/Delete/Share) that ORs into the integer.
- **Binary data lifecycle** — Upload reads the named binary property via `getBinaryDataBuffer(i, propertyName)` and `PUT`s the buffer with the file's content type. Download uses `prepareBinaryData(buffer, fileName, mimeType)` and returns it under the configured output binary property; the JSON item still carries path/metadata. Do not base64-round-trip through JSON.
- **Debug & observability** — scrub secrets on `continueOnFail` strings and before every `NodeApiError` (execute + `listSearch`), exactly as Calendar does. Unit tests must fail if a fixture `appPassword` survives a scrubbed error.

## Phase 1: WebDAV file & folder operations + resource pickers

### Overview

Create the `Nextcloud Files` node with `file` and `folder` resources over WebDAV, FR-011 path pickers, binary upload/download, and register it — reusing the shared credential and S-01 helper patterns. No live Nextcloud required to pass automated checks.

### Changes Required:

#### 1. Node scaffold + description root

**File**: `nodes/NextcloudFiles/NextcloudFiles.node.ts` (new), `nodes/NextcloudFiles/NextcloudFiles.node.json` (new), `nodes/NextcloudFiles/nextcloudFiles.svg` (new)

**Intent**: Establish the programmatic app node mirroring Calendar so the panel gains a Files slot bound to the shared credential.

**Contract**: `INodeType` with `displayName = 'Nextcloud Files'`, `name = 'nextcloudFiles'`, `icon = 'file:nextcloudFiles.svg'`, `credentials: [{ name: 'nextcloudApi', required: true }]`, `usableAsTool: true`, and a top-level `resource` options field (`file`, `folder`) plus spread resource descriptions. `execute` loops items, resolves resource+operation, dispatches to WebDAV helpers, and uses the S-01 catch pattern (scrub + `getHttpStatusCode` + `continueOnFail`/`NodeApiError`). `.node.json` mirrors Calendar's with `node: "n8n-nodes-nextcloud.nextcloudFiles"` and WebDAV doc URLs.

#### 2. WebDAV generic functions

**File**: `nodes/NextcloudFiles/GenericFunctions.ts` (new), `nodes/NextcloudFiles/FilesInterface.ts` (new)

**Intent**: Centralize credential loading, the auth'd request wrapper with widened verbs, WebDAV URL building, and PROPFIND multistatus parsing so encoding/behavior can't drift across operations.

**Contract**: Export `getCredentials` (reuse `NextcloudCredentialData` shape), `nextcloudRequest(context, method, url, body?, headers?)` over `httpRequestWithAuthentication('nextcloudApi', …)` with `NextcloudHttpMethod` union, `buildFilesUrl(baseUrl, username, path)` (per-segment encoding), `buildDestinationHeader(...)`, and `parseDirectoryListingFromMultistatus(xml)` → array of `{ href, basename, path, isFolder, size?, lastModified?, contentType?, etag? }`. Keep XML parsing as regex/string helpers (no new runtime dependency), following Calendar's `parseTagValue` approach.

#### 3. File resource

**File**: `nodes/NextcloudFiles/resources/file/index.ts` (new)

**Intent**: Provide legacy-standard file operations with binary in/out and FR-011 path selection.

**Contract**: `operation` options `Upload` / `Download` / `Delete` / `Move` / `Copy`. Fields: a `path` `resourceLocator` (list + manual) for the source; for Upload a source binary property name + optional target file name; for Download an output binary property name; for Move/Copy a destination `path` string + `Overwrite` boolean (default false). Execute mapping: Upload→`PUT` buffer, Download→`GET`→`prepareBinaryData`, Delete→`DELETE`, Move→`MOVE`+Destination, Copy→`COPY`+Destination. Output items carry `{ path, ... }` plus binary where relevant.

#### 4. Folder resource

**File**: `nodes/NextcloudFiles/resources/folder/index.ts` (new)

**Intent**: Provide legacy-standard folder operations, including listing directory contents as workflow items.

**Contract**: `operation` options `Create` / `Delete` / `List` / `Move` / `Copy`. Fields: `path` `resourceLocator` (list + manual); Move/Copy add destination `path` + `Overwrite`; List adds a `Limit`/`Return All` pair (mirror Calendar's `getAll` fields, default Limit 100). Execute mapping: Create→`MKCOL`, Delete→`DELETE`, List→`PROPFIND Depth:1`→one item per child via `parseDirectoryListingFromMultistatus`, Move/Copy→`MOVE`/`COPY`+Destination.

#### 5. Shared descriptions, pickers, and ported helpers

**File**: `nodes/NextcloudFiles/shared/descriptions.ts` (new), `nodes/NextcloudFiles/shared/scrubSecrets.ts` (new), `nodes/NextcloudFiles/shared/httpStatus.ts` (new), `nodes/NextcloudFiles/listSearch/getFolders.ts` (new)

**Intent**: Supply the reusable `path` picker field plus the secret-scrub and http-status helpers (kept node-local, matching the S-01 convention), and a `listSearch` that browses a directory level for FR-011.

**Contract**: `pathSelect` `resourceLocator` (`default { mode: 'list', value: '' }`, `list` mode → `searchListMethod: 'getFolders'` searchable, `id` mode → manual path string, e.g. `/Documents/report.pdf`). Port `scrubSecrets`/`scrubErrorMessage` and `getHttpStatusCode` verbatim from Calendar. `getFolders.ts` PROPFINDs a directory (supports the `filter` as a sub-path) and returns child folders (and optionally files) as `{ name, value }` results, scrubbing errors before surfacing.

#### 6. Register node + README touch

**File**: `package.json`, `README.md`

**Intent**: Make the node loadable and keep docs honest.

**Contract**: Append `dist/nodes/NextcloudFiles/NextcloudFiles.node.js` to `n8n.nodes` (Calendar stays). Add a "Nextcloud Files" line to the README "What's Included" section. No credential-list change.

#### 7. Unit tests (pure helpers)

**File**: `nodes/NextcloudFiles/test/GenericFunctions.test.ts` (new), `nodes/NextcloudFiles/test/scrubSecrets.test.ts` (new)

**Intent**: Lock URL building, directory-listing parsing, and secret scrubbing without a live server.

**Contract**: Assert `buildFilesUrl` per-segment encoding (spaces, unicode, nested paths), `Destination`/`Overwrite` header shape, `parseDirectoryListingFromMultistatus` on a fixture Nextcloud multistatus (folder vs file, size/mtime extraction), and that a fixture `appPassword` / Basic header / `user:pass` string is fully redacted while clean strings pass through.

### Success Criteria:

#### Automated Verification:

- Node tree exists: `NextcloudFiles.node.ts`, `GenericFunctions.ts`, `FilesInterface.ts`, `resources/file`, `resources/folder`, `shared/`, `listSearch/getFolders.ts`, icon, `.node.json`
- `package.json` `n8n.nodes` lists both `NextcloudCalendar` and `NextcloudFiles`; `n8n.credentials` unchanged
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (GenericFunctions + scrubSecrets)

#### Manual Verification:

- (Optional mid-phase) Package loads in n8n after rebuild/link with **Nextcloud Files** visible — full smoke deferred to Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Sharing via OCS API

### Overview

Add the `share` resource backed by the OCS files_sharing API (JSON + `OCS-APIRequest` header), covering create / get many / update / delete, with a permission-bitmask UI and public-link output — completing the "share-style operations" of legacy-standard coverage.

### Changes Required:

#### 1. OCS request helper

**File**: `nodes/NextcloudFiles/GenericFunctions.ts` (extend)

**Intent**: Add a single OCS choke point that sets the required header, forces JSON, and unwraps the `ocs` envelope with combined HTTP/OCS status handling.

**Contract**: `ocsRequest(context, method, apiPath, body?, qs?)` → builds `{base}/ocs/v2.php/apps/files_sharing/api/v1/{apiPath}` with `format=json`, sets `OCS-APIRequest: 'true'` + `Accept: application/json`, returns `ocs.data`. Export a `permissionsToBitmask(string[])` helper and a `parseShare(data)` normalizer surfacing `{ id, shareType, shareWith?, path, permissions, url?, token?, expiration?, ... }`.

#### 2. Share resource

**File**: `nodes/NextcloudFiles/resources/share/index.ts` (new)

**Intent**: Expose share CRUD with the standard share types and options.

**Contract**: `operation` options `Create` / `Get Many` / `Update` / `Delete`. Create fields: `path` (`resourceLocator`, reusing `pathSelect`), `shareType` (User / Group / Public Link / Email), `shareWith` (shown for user/group/email), `permissions` (multi-select → bitmask), optional `password`, `expireDate`, `publicUpload`, `note`. Get Many: optional `path` filter + `Return All`/`Limit`. Update: `shareId` + editable permissions/password/expireDate/publicUpload. Delete: `shareId`. Register `share` in the node's top-level `resource` options.

#### 3. Unit tests (OCS parsing)

**File**: `nodes/NextcloudFiles/test/ocs.test.ts` (new)

**Intent**: Lock permission-bitmask math and share-envelope parsing.

**Contract**: Assert `permissionsToBitmask(['read','share'])` → 17 (etc.), and `parseShare` extracts id/url/token/permissions from a fixture OCS JSON `ocs.data` (both single-object create and array list shapes).

### Success Criteria:

#### Automated Verification:

- `share` resource exists and is registered in the node's `resource` options
- `ocsRequest` / `permissionsToBitmask` / `parseShare` implemented in `GenericFunctions.ts`
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (adds OCS parsing tests)

#### Manual Verification:

- (Optional mid-phase) Share resource appears with type-dependent fields — full smoke deferred to Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: North-star local verification

### Overview

Prove S-03 / FR-004 / FR-011 on a real Nextcloud via the F-01 link path: shared-credential reuse, all file/folder/share operations, both picker modes, binary round-trips, and no secret leakage.

### Changes Required:

#### 1. Manual verification only

**File**: none required (docs updated in Phase 1)

**Intent**: Close the slice with human-run evidence against a real instance; fix forward into this phase only if verification surfaces defects.

**Contract**: Follow the README F-01 gate (`build` → `npm link` → link `n8n-nodes-nextcloud` in `~/.n8n/custom` → `n8n start`). Attach the existing Nextcloud API credential (proving reuse). Exercise File Upload/Download/Delete/Move/Copy (binary in and out), Folder Create/Delete/List/Move/Copy, and Share Create (user + public link)/Get Many/Update/Delete. Confirm the path `resourceLocator` works in both **From List** and **By ID** modes. Force a failure and confirm `appPassword` is not echoed.

### Success Criteria:

#### Automated Verification:

- Re-run `npm run build`, `npm run lint`, and `npm test` after any Phase 3 fixes

#### Manual Verification:

- After F-01 link path, node panel search finds **Nextcloud Files** from this package
- The existing shared `nextcloudApi` credential attaches and authorizes Files operations (credential reuse proven)
- File Upload/Download/Delete/Move/Copy produce useful items and binary round-trips correctly (no secrets in outputs)
- Folder Create/Delete/List/Move/Copy work; List returns one item per child
- Path `resourceLocator` works in list mode and manual id mode
- Share Create (public link returns URL/token), Get Many, Update, Delete work
- A deliberate bad request / continue-on-fail path does not expose `appPassword`

**Implementation Note**: This phase is the human gate for S-03. Pause until manual confirmation succeeds before treating the change as implemented.

---

## Testing Strategy

### Unit Tests:

- `buildFilesUrl` per-segment encoding (spaces, unicode, nested paths, trailing slash) and `Destination`/`Overwrite` header construction
- `parseDirectoryListingFromMultistatus` on a fixture multistatus (folder vs file discrimination, size/mtime/contenttype extraction, self-vs-child)
- `permissionsToBitmask` combinations and `parseShare` on create (object) and list (array) OCS envelopes
- Scrubber: fixture `appPassword`, `Authorization: Basic …`, and `user:pass@` URL credentials fully redacted; clean strings unchanged

### Integration Tests:

- None in CI (no live Nextcloud). Manual Phase 3 is the integration proof.

### Manual Testing Steps:

1. `npm run build && npm run lint && npm test` in `packages/nextcloud`
2. F-01 link path; search panel for **Nextcloud Files**; attach the existing shared credential
3. Folder Create `/n8n-test`; List parent to see it; Move/Copy it; Delete it
4. File Upload a binary into `/n8n-test`; Download it back (verify bytes); Move/Copy; Delete
5. Share Create a public link on a file (capture URL/token); Get Many; Update permissions/expiry; Delete
6. Exercise the path picker in From List and By ID modes
7. Trigger an error (bad path) with continue-on-fail and confirm redaction

## Performance Considerations

WebDAV List and the `listSearch` picker use `PROPFIND Depth: 1` (single directory level) — acceptable for MVP volumes; no recursive crawl. Uploads/downloads stream a single buffer (no chunking) — large-file/chunked upload is explicitly out of scope. No new runtime dependencies (regex/string XML + JSON OCS parsing only).

## Migration Notes

- Additive change: existing local links keep working; rebuild/restart n8n so the new node appears next to Calendar.
- No credential change — S-01's `nextcloudApi` is reused as-is, directly exercising the shared-credential guardrail.
- No npm publish in this change.

## References

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD: FR-004, FR-011, guardrails — `context/foundation/prd.md`
- Frame (rewrite, not zahidcoder; endpoint cheat-sheet only): `context/changes/zahidcoder-adopt-or-rewrite/frame.md`
- S-01 pattern to mirror: `context/archive/2026-07-18-shared-basic-auth-calendar/plan.md`, `nodes/NextcloudCalendar/**`
- Shared credential: `credentials/NextcloudApi.credentials.ts`
- Nextcloud WebDAV basics: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/basic.html
- Nextcloud OCS Share API: https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-share-api.html

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: WebDAV file & folder operations + resource pickers

#### Automated

- [x] 1.1 Node tree exists (node.ts, GenericFunctions, FilesInterface, resources file/folder, shared, listSearch/getFolders, icon, node.json) — b0d47e5
- [x] 1.2 `package.json` `n8n.nodes` lists both NextcloudCalendar and NextcloudFiles; credentials unchanged — b0d47e5
- [x] 1.3 `npm run build` succeeds — b0d47e5
- [x] 1.4 `npm run lint` succeeds — b0d47e5
- [x] 1.5 `npm test` succeeds (GenericFunctions + scrubSecrets) — b0d47e5

#### Manual

- [x] 1.6 Phase 1 pause — human confirms file/folder node ready before OCS sharing — b0d47e5

### Phase 2: Sharing via OCS API

#### Automated

- [x] 2.1 `share` resource exists and is registered in the node `resource` options — 61db982
- [x] 2.2 `ocsRequest` / `permissionsToBitmask` / `parseShare` implemented in GenericFunctions — 61db982
- [x] 2.3 `npm run build` succeeds — 61db982
- [x] 2.4 `npm run lint` succeeds — 61db982
- [x] 2.5 `npm test` succeeds (adds OCS parsing tests) — 61db982

#### Manual

- [x] 2.6 Phase 2 pause — human confirms sharing ready for north-star smoke — 61db982

### Phase 3: North-star local verification

#### Automated

- [ ] 3.1 `npm run build`, `npm run lint`, and `npm test` still pass after any Phase 3 fixes

#### Manual

- [ ] 3.2 F-01 link path — panel finds Nextcloud Files
- [ ] 3.3 Existing shared `nextcloudApi` credential attaches and authorizes Files ops (reuse proven)
- [ ] 3.4 File Upload/Download/Delete/Move/Copy produce useful items with correct binary round-trip and no secrets
- [ ] 3.5 Folder Create/Delete/List/Move/Copy work; List returns one item per child
- [ ] 3.6 Path resourceLocator works in list and manual id modes
- [ ] 3.7 Share Create (public link URL/token)/Get Many/Update/Delete work
- [ ] 3.8 Error path does not expose `appPassword`
