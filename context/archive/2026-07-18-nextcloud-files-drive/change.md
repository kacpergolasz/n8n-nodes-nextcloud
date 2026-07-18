---
change_id: nextcloud-files-drive
title: Nextcloud Files/Drive node (legacy-standard coverage)
status: archived
created: 2026-07-18
updated: 2026-07-18
archived_at: 2026-07-18T21:06:25Z
---

## Notes

Roadmap S-03 / FR-004. Vertical **Nextcloud Files** app node (mirrors the Google Drive panel slot) built on the shared `nextcloudApi` Basic Auth credential from S-01 — no new credential. Three resources: `file` (upload/download/delete/move/copy), `folder` (create/delete/list/move/copy), `share` (create/get many/update/delete via OCS files_sharing API). Reuses the S-01 patterns: programmatic `execute`, `resourceLocator` + `listSearch` pickers (FR-011), secret scrubbing on every error path, Vitest pure-function tests, no live Nextcloud in CI.

Endpoints grounded against Nextcloud developer docs (WebDAV `remote.php/dav/files/{user}/…`; OCS `ocs/v2.php/apps/files_sharing/api/v1/shares`). zahidcoder is an endpoint cheat-sheet only — architecture is the local rewrite, not a fork.

Phase 3 north-star verification complete (2026-07-18). File, folder, and share operations verified on a live Nextcloud instance via F-01 link path.

Explicit out-of-scope: Drive v2 parity stretch, OAuth2 (S-02), OCS user-provisioning/admin, other suite apps (Deck/Talk/News), triggers (S-07). All ⭐ Recommended planning decisions were adopted autonomously (see `plan-brief.md` → Key Decisions, Source=Plan) because this ran without an interactive human.
