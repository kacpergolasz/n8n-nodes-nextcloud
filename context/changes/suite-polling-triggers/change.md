---
change_id: suite-polling-triggers
title: Suite polling triggers
status: implementing
created: 2026-07-19
updated: 2026-07-20
archived_at: null
---

## Notes

Suite polling pattern is documented in [`follow-ups/next-app-triggers.md`](follow-ups/next-app-triggers.md).

**Shipped (S-07):** `NextcloudFilesTrigger` — Depth-1 folder watch, snapshot diff on `etag`/`lastModified`, events `fileCreated` / `fileUpdated` / `folderCreated` / `folderUpdated`, soft-fail after init, manual one-sample Test step.

**Next apps:** Calendar (after S-08 + LAST-MODIFIED), Deck (timestamps or ID dedupe), Talk (Gmail-like, after Talk node exists). All should reuse `nodes/shared/pollHelpers.ts` and the one-trigger-per-app registration pattern.
