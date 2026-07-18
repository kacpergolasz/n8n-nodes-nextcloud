# Review follow-ups (Phase 2 impl-review)

## Deferred to roadmap

- **F2 — Card update PUT sends full GET entity** → `S-10: deck-partial-update` in `context/foundation/roadmap.md`. Implement `buildCardUpdatePayload` whitelist after S-04 ships.

## Fixed during triage (2026-07-18)

- F1 — Removed hidden `type` from card update patch
- F3 — Invalid due date guard in `formatDeckDueDate`
- F4 — Card title `required: true` on create
- F5 — `clearDueDate` additional field on card update
- F6 — `resolveCardId()` helper
- F7 — Documented client-side Get Many behavior on Return All field
