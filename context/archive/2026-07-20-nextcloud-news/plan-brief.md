# Nextcloud News — Plan Brief

> Full plan: `context/changes/nextcloud-news/plan.md`
> Research: `context/changes/nextcloud-news/research.md`

## What & Why

Ship **Nextcloud News** actions (API v1.3) plus a **News polling trigger** for new articles (FR-008 / S-06), so authors can manage feeds/folders/items and start workflows when news arrives — without waiting for a generic suite-triggers expansion.

## Starting Point

Shared `nextcloudApi` + Deck/Files/Calendar actions exist. Master already has `pollHelpers` + **Files Trigger**. No News node yet; suite Get Many is still fetch-all + slice. News v2 is draft-only (S-14).

## Desired End State

Authors use **Nextcloud News** for Folder/Feed/Item ops (incl. mark feed read + favicon) with real item `batchSize`/`offset` paging, and **Nextcloud News Trigger** (optional folder/feed + Unread only) emits one full article JSON per newly seen id — no activation flood; soft-fail surfaces one notice item.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| API version | v1.3 only | v2 incomplete upstream | Research |
| Scope | Actions + Trigger | Matches News automation use case | Plan |
| Trigger event | New article ids + Unread only checkbox | Simple “new news” without full sync client | Plan |
| Trigger output | Full item JSON each | Easiest workflow mapping | Plan |
| Trigger scope | Optional folder and/or feed | Files-like watch targeting | Plan |
| Actions MVP | Folder + Feed + Item (+ mark feed read, favicon) | Solid vertical without updater/filters | Plan |
| Pagination | Shared helpers; News cursor first; suite retrofit S-15 | Fix lame slice pattern without blocking on full suite rewrite | Plan |
| Poll errors | Soft-fail + one notice item | Visible without killing cron | Plan |
| Branch base | Merge master early | Reuse `pollHelpers` / Files Trigger schema | Plan |
| Deferred | v2, suite pagination retrofit, updater, `/user`, filters, folder mark-read, delete detection | Keep S-06 shippable | Research + Plan |

## Scope

**In scope:** Merge master; `nodes/shared/pagination.ts`; `NextcloudNews` actions; Item Get Many cursor paging; `NextcloudNewsTrigger`; registration; Vitest; local smoke.

**Out of scope:** API v2 (S-14); Deck/Files/Calendar pagination retrofit (S-15); admin updater; feed filters; OAuth2; live CI; npm publish.

## Architecture / Approach

Deck-shaped JSON REST node (`newsApiBase` → `/index.php/apps/news/api/v1-3`) + Files-shaped trigger using `filterIdsInStaticData` for new article ids. Shared pagination module serves News items now and other apps later.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Merge + pagination module | Master sync + shared helpers | Merge conflicts |
| 2. News actions scaffold | Folder/Feed/Item ops + favicon + mark feed read | Bulk-mark doc mismatch vs live routes |
| 3. Item Get Many cursor | Real `batchSize`/`offset` | Accidental unbounded `-1` pulls |
| 4. News Trigger | ID-window poll + filters + notice soft-fail | Scope-change re-seed bugs |
| 5. Close-out | Docs + full build/lint/test + F-01 smoke | Panel registration misses |

**Prerequisites:** S-01 done; News app on target NC; merge `origin/master` for poll helpers.
**Estimated effort:** ~3–5 sessions across 5 phases.

## Open Risks & Assumptions

- Bulk mark route shapes need live/`routes.php` confirmation (docs inconsistent).
- Soft-fail notice must not advance the ID window or spam every tick.
- Pretty-URL installs may omit `index.php` — verify like Deck.

## Success Criteria (Summary)

- News actions produce useful JSON/binary outputs on shared credential
- Item Get Many pages via `batchSize`/`offset`
- Trigger fires once per new article (optional unread/feed/folder scope) without activation flood
