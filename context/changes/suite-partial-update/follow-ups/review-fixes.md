# Review follow-ups — suite-partial-update

Queued from full-plan impl-review triage (2026-08-01).

## Open

_(none)_

## Done

### F5 — `setProp` leaves earlier duplicate ICS properties

- **Source**: `reviews/impl-review-final.md` (was SKIPPED; fixed 2026-08-01)
- **Change**: `setProp` now removes all same-name properties then pushes the new value; duplicate-SUMMARY test expects a single property.
- Completes Phase 1–4 `impl-review.md` F8 (last-index align was incomplete).
