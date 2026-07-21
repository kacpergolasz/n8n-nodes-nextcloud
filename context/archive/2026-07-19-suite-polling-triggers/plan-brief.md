# Suite Polling Triggers — Plan Brief

> Full plan: `context/changes/suite-polling-triggers/plan.md`
> Research: `context/changes/suite-polling-triggers/research.md`

## What & Why

Ship the first Nextcloud suite **polling trigger** so workflows can start when Files change (FR-009 / S-07). Polling is an n8n trigger path (`poll()`), separate from existing Get/List action nodes. Files is first because Calendar listing is blocked on S-08 and lacks a true “changed since” query.

## Starting Point

Three action nodes (Calendar, Deck, Files) + `nextcloudApi`; zero triggers. Files already returns `etag` / `lastModified` / `isFolder` via Depth-1 PROPFIND. n8n injects Poll Times and schedules ticks when `polling: true`.

## Desired End State

Authors add **Nextcloud Files Trigger**, pick a folder, choose created/updated events, and get workflow runs for **direct children** only — no history flood on first activate; Test step returns a sample item.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| First app | Files Trigger | Strongest change-detection fields in existing code; Calendar blocked by S-08 | Plan + Research |
| This-change scope | One solid trigger + pattern note | Delivers FR-009 without weak Calendar/Deck polls | Plan |
| Events | Created + updated in watched folder | Matches Google Drive folder-watch UX | Plan |
| Recursion | Depth 1 only (notice) | Matches `loadDirectoryListing` + Drive subfolder notice | Research + Plan |
| Helpers | Tiny `nodes/shared/pollHelpers.ts` | Reuse cursor/dedupe without a fake framework | Plan |
| Errors / manual | Soft-fail with cursor; manual sample-1 + throw if empty | Avoid skipping windows on blips; clear editor UX | Plan |
| Tests | Vitest helpers + mocked `poll()` | Matches package style; no live NC in CI | Plan |
| Packaging | One Trigger node per app | Google suite + PRD panel shape | Research |

## Scope

**In scope:** `NextcloudFilesTrigger`, shared poll helpers, snapshot classify, registration, unit tests, follow-on pattern note.

**Out of scope:** Calendar/Deck/Talk/News triggers, webhooks, deletes, recursive watch, delta/sync-collection, S-08 CalDAV, OAuth2, live CI against Nextcloud.

## Architecture / Approach

n8n cron → `poll()` → PROPFIND Depth 1 on `folderToWatch` → diff static-data snapshot (`path` → etag/lastModified) → emit created/updated items or `null`. Reuse Files WebDAV helpers; keep classification pure and tested.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Shared poll helpers | Cursor/dedupe utils + tests | Over-abstracting too early |
| 2. Snapshot classification | Pure create/update diff + tests | Etag vs lastModified edge cases |
| 3. Trigger shell + registration | Panel-visible polling node | listSearch folders-only wiring |
| 4. Wire `poll()` | Real WebDAV poll + soft-fail/manual | Static-data persistence on seed-without-emit |
| 5. `poll()` unit tests | Mocked end-to-end poll coverage | Mock fidelity vs real NC |
| 6. Suite pattern note | How Calendar/Deck follow | Notes drift from shipped behavior |

**Prerequisites:** Files action node + `nextcloudApi` (present); local n8n community-node path for manual phases.
**Estimated effort:** ~2–4 sessions across 6 phases.

## Open Risks & Assumptions

- First-poll snapshot must persist even when returning `null` — verify on target n8n version in Phase 4.
- Soft-fail can hide bad folder paths after a good seed — accepted tradeoff.

## Success Criteria (Summary)

- Files Trigger starts workflows on direct-child create/update
- No history flood on activation; Test step returns a sample
- `npm run build && npm run lint && npm test` green
