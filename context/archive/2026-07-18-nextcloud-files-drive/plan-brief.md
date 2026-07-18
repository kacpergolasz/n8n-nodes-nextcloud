# Nextcloud Files/Drive Node — Plan Brief

> Full plan: `context/changes/nextcloud-files-drive/plan.md`
> Frame brief (endpoint cheat-sheet only): `context/changes/zahidcoder-adopt-or-rewrite/frame.md`

## What & Why

n8n's core Nextcloud file surface is thin, and the PRD's Google-mirror suite has no Files/Drive app node yet. This slice (roadmap S-03 / FR-004) adds a vertical **Nextcloud Files** node with legacy-standard file/folder/share coverage, built on the shared `nextcloudApi` credential from S-01 — giving workflow authors a real Drive-equivalent without leaving Nextcloud.

## Starting Point

The package ships one suite node (**Nextcloud Calendar**) plus the shared `nextcloudApi` Basic Auth credential, with Vitest and secret-scrubbing patterns already established in S-01. There is no Files/Drive node, so nothing in the package addresses the thin-core-file pain today. Calendar is the structural template to mirror.

## Desired End State

Searching "nextcloud" in the panel shows **Nextcloud Files** beside Nextcloud Calendar. With the same shared credential, an author can upload/download/delete/move/copy files, create/delete/list/move/copy folders, and create/list/update/delete shares (including public links that return a URL) — choosing paths from a loaded list or typing them manually, with no secrets ever leaking into outputs or errors.

## Key Decisions Made

This slice ran autonomously (no interactive human), so every ⭐ Recommended option was adopted during planning — all rows are Source=Plan.

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Coverage scope ("legacy-standard") | Mirror core n8n Nextcloud file/folder ops + a full share resource | Matches the "file/folder/share-style operations" outcome without Drive-v2 stretch | Plan |
| Node shape | One `Nextcloud Files` node with `file` / `folder` / `share` resources | Mirrors the Google Drive panel slot and core Nextcloud node; keeps Files vertical, not a suite monolith | Plan |
| Credential | Reuse shared `nextcloudApi` Basic Auth (no new credential) | Directly exercises the shared-credential guardrail; OAuth2 is S-02 | Plan |
| Resource pickers (FR-011) | `resourceLocator` path field: `getFolders` listSearch browse + manual `id` | Reuses the proven S-01 picker pattern; PROPFIND naturally browses one directory level | Plan |
| Binary handling | n8n binary property in/out (`getBinaryDataBuffer` / `prepareBinaryData`) | Idiomatic n8n and core-node parity; avoids base64-in-JSON memory bloat | Plan |
| WebDAV verbs | Local `NextcloudHttpMethod` union (`PROPFIND`/`MKCOL`/`MOVE`/`COPY`) | Same technique Calendar uses for CalDAV verbs n8n's type omits | Plan |
| Move/Copy semantics | Absolute `Destination` header + `Overwrite` toggle (default false) | Standard WebDAV contract; explicit overwrite avoids silent clobber | Plan |
| OCS transport | `format=json` + `OCS-APIRequest: true`, parse `ocs.data`, permissions as bitmask multi-select | JSON avoids a second XML parser; friendly permission UI ORs into the integer | Plan |
| Error handling | Port S-01 scrub + http-status catch pattern; `continueOnFail` returns scrubbed item | Non-negotiable no-secrets guardrail; consistent with Calendar | Plan |
| Helper location | Keep helpers node-local (port scrub/httpStatus into `NextcloudFiles/`) | Matches current repo convention; avoids touching Calendar in a parallel slice | Plan |
| Testing | Vitest pure-function tests (URL/parse/bitmask/scrub) + manual Phase 3 | No live Nextcloud in CI, mirrors S-01 | Plan |

## Scope

**In scope:**
- `file`: Upload, Download, Delete, Move, Copy (WebDAV)
- `folder`: Create, Delete, List, Move, Copy (WebDAV)
- `share`: Create, Get Many, Update, Delete (OCS files_sharing)
- FR-011 path pickers (list browse + manual); shared `nextcloudApi` reuse; secret scrubbing; unit tests

**Out of scope:**
- OAuth2 (S-02); Deck/Talk/News (S-04–06); triggers (S-07)
- Drive-v2 stretch: chunked upload, versions, trashbin, tags, comments, favorites, full-text search
- OCS user/group provisioning & admin endpoints; exotic share types (federated/circle/Talk)
- Live CI integration tests; npm publish; Calendar helper DRY refactor

## Architecture / Approach

One programmatic `INodeType` under `nodes/NextcloudFiles/`, mirroring Calendar's layout: `GenericFunctions.ts` (credential load, auth'd request with widened verbs, WebDAV URL builder, multistatus parser, OCS helper), `resources/{file,folder,share}/`, `shared/` (path picker description + ported scrub/httpStatus), `listSearch/getFolders.ts`. File/folder ops hit `remote.php/dav/files/{user}/…`; shares hit `ocs/v2.php/apps/files_sharing/api/v1/shares`. Registered as a second entry in `package.json` `n8n.nodes`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. WebDAV file & folder + pickers | File/folder ops with binary in/out and FR-011 path pickers, registered node, helper unit tests | WebDAV path-encoding correctness; binary property round-trip |
| 2. Sharing via OCS | `share` CRUD with permission bitmask and public-link output | OCS status can hide inside a 200 body; permission bitmask mapping |
| 3. North-star local verification | Human proof on a real Nextcloud across all ops + both picker modes | Requires a reachable Nextcloud instance |

**Prerequisites:** S-01 done (shared credential + Calendar patterns present, Vitest wired); a reachable Nextcloud for Phase 3.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- **listSearch depth**: the path picker browses one directory level (PROPFIND Depth 1); no recursive tree browse — assumed acceptable for MVP.
- **OCS version path**: plan uses `ocs/v2.php`; very old servers may only expose `ocs/v1.php` — if Phase 3 hits this, add a version fallback.
- **Public-link permission defaults**: Nextcloud defaults public shares to read-only (permissions 1) and may block public upload by admin policy — surfaced as errors, not worked around.
- **Helper duplication**: scrub/httpStatus are copied from Calendar; a later slice may DRY them into a package-level shared module.
- **Minimum Nextcloud version** remains an open roadmap question (does not gate planning).

## Success Criteria (Summary)

- Author automates Nextcloud files, folders, and shares in n8n using the **same** shared credential proven on Calendar.
- Both FR-011 picker modes work; binary upload/download round-trips correctly.
- `appPassword` never appears in outputs, logs, or errors; `build` + `lint` + `test` pass.
