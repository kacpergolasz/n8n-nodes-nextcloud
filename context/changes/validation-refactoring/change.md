---
change_id: validation-refactoring
title: Validation refactoring
status: impl_reviewed
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

### Implementation adaptations

- **Zod placement (Phase 1):** Declared in `devDependencies` (`^3.25.67`), not `peerDependencies` / `dependencies`. Community-node lint only allows `n8n-workflow` (and optionally AI SDK) as peers, and forbids runtime `dependencies`. Runtime still uses host-provided Zod (Cloud allowlisted via `n8n-workflow`).
- **Calendar OAuth credentials:** Basic auth uses shared `parseNextcloudCredentials`. OAuth keeps a node-local Zod schema / wider `NextcloudCredentialData` in Calendar (Phase 1 `parse.ts` deferred OAuth assembly). Both paths are cast-free; sharing the OAuth schema is a follow-up, not a Phase 7 blocker.
