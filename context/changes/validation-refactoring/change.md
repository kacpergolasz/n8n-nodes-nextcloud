---
change_id: validation-refactoring
title: Validation refactoring
status: planned
created: 2026-07-21
updated: 2026-07-21
archived_at: null
---

## Notes

### Reminders (planning decisions)

- **Before `/10x-impl-review`:** Test bar was intentionally light (typecheck + existing tests only — no new parser unit-test mandate). Review validation/cast removal carefully; push for extra tests if any parser looks under-proven.
- **Before next-to-last phase (boundary allowlist):** Stop and focus — document every remaining prod `as` (WebDAV method, poll adapters, etc.), prefer eliminating over exempting, and only then add precise `eslint-disable-next-line` + reason / file overrides. Do not rush this into the final ESLint phase.

### Output DTO convention

Export JSON/output shapes as `type` (not `interface`) without `[key: string]: unknown` so they assign to `IDataObject` without casts.
