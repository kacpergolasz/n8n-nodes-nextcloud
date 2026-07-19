---
project: "Nextcloud community node (complete integration)"
version: 1
status: draft
created: 2026-07-18
updated: 2026-07-19
prd_version: 1
main_goal: quality
top_blocker: none
---

# Roadmap: Nextcloud community node (complete integration)

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

n8n lacks a complete Nextcloud suite: core only offers a thin file surface, and Calendar, Deck, Talk, and the rest are not first-class. Automation builders on self-hosted Nextcloud need a coherent community package that mirrors the Google node-panel shape — separate app nodes, one shared credential, resource pickers — without stitching incomplete packages or staying on Google.

## North star

**S-01: user can create a shared Basic Auth credential and run Calendar operations with useful outputs (including list-or-type resource pickers)** — this is the north star: the smallest end-to-end slice whose successful delivery would prove the core hypothesis — that a Google-alternative Nextcloud suite in n8n works via one shared credential — and it is the Primary Success Criteria first proven path, placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | local-community-node-verify | (foundation) package builds and runs via local n8n community-node link for verification | — | FR-003 | done |
| S-01 | shared-basic-auth-calendar | create shared Basic Auth credential, run Calendar events, pick resources from lists or manually | F-01 | US-01, FR-001, FR-011 | done |
| S-08 | calendar-get-many-caldav | list more than a truncated PROPFIND page of Calendar events (reliable Get Many) | S-01 | US-01, FR-001 | proposed |
| S-09 | calendar-partial-update | update a Calendar event with only changed fields | S-01 | US-01, FR-001 | proposed |
| S-02 | shared-oauth2-credential | create and use shared OAuth2 credential across suite nodes (proven on Calendar) | S-01 | FR-002 | proposed |
| S-03 | nextcloud-files-drive | automate Nextcloud Files/Drive at legacy-standard coverage | S-01 | FR-004 | done |
| S-04 | nextcloud-deck | automate Nextcloud Deck (boards/cards) | S-01 | FR-005 | done |
| S-10 | deck-partial-update | update a Deck card with only whitelisted writable fields (safe GET→merge→PUT) | S-04 | FR-005 | proposed |
| S-05 | nextcloud-talk | automate Nextcloud Talk | S-01 | FR-006 | proposed |
| S-06 | nextcloud-news | automate Nextcloud News | S-01 | FR-008 | proposed |
| S-07 | suite-polling-triggers | use polling triggers for suite changes | S-01 | FR-009 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Credential & Calendar proof | `F-01` → `S-01` → `S-08` / `S-09` → `S-02` | Quality-first validation path; Calendar depth (Get Many / partial update) follows the north star; OAuth follows once Calendar proves the shared credential. |
| B | Suite apps | `S-03` / `S-04` / `S-05` / `S-06` | Parallel after `S-01`; joins Stream A at the shared credential. |
| C | Triggers | `S-07` | Polling after Calendar exists; expands as suite apps land. |

## Baseline

What's already in place in the codebase as of `2026-07-18` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — no web SPA; n8n node UI via property descriptions only (`nodes/**`, package build tooling)
- **Backend / API:** partial — starter GithubIssues/Example nodes and credentials; no Nextcloud suite nodes yet (prior Calendar art outside this package)
- **Data:** per tech-stack.md — no package database; n8n hosts persistence
- **Auth:** per tech-stack.md — n8n hosts auth; package only defines credential types (currently starter stubs, not Nextcloud)
- **Deploy / infra:** present — GitHub Actions CI + npm publish workflows
- **Observability:** absent — no package-level error tracking or metrics

## Foundations

### F-01: Local community-node verification path

- **Outcome:** (foundation) package builds and runs via the local n8n community-node path so suite work can be verified before npm publish.
- **Change ID:** local-community-node-verify
- **PRD refs:** FR-003
- **Unlocks:** S-01 (and every later slice's local verification path)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first so Calendar quality work is never planned without a runnable local check; failure mode is shipping nodes that cannot be exercised in n8n.
- **Status:** done

## Slices

### S-01: Shared Basic Auth + Calendar

- **Outcome:** user can create a shared Nextcloud Basic Auth credential, run Calendar event operations with useful workflow outputs, and pick remote resources via loaded lists with manual-input fallback — without secrets in outputs or errors.
- **Change ID:** shared-basic-auth-calendar
- **PRD refs:** US-01, FR-001, FR-011
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star and quality gate for the shared-credential contract; if this is weak, later suite nodes inherit a bad pattern.
- **Status:** done

### S-08: Calendar Get Many via CalDAV query

- **Outcome:** user can Get Many Calendar events beyond the truncated PROPFIND page (default Limit 10 matches observed server behavior until this lands), with Return All / Limit behaving against a complete listing strategy (likely `REPORT` `calendar-query` and/or paging).
- **Change ID:** calendar-get-many-caldav
- **PRD refs:** US-01, FR-001
- **Prerequisites:** S-01
- **Parallel with:** S-09, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** Exact Nextcloud/Sabre truncation rules for PROPFIND + `calendar-data`; whether `calendar-query` REPORT alone is enough or sync-collection / offset+limit is required.
- **Risk:** S-01 ships a working but incomplete Get Many; leaving this untracked would silently under-fetch events in production workflows.
- **Status:** proposed

### S-09: Calendar partial event update

- **Outcome:** user can Update a Calendar event by sending only changed fields (node performs GET → merge → PUT under the hood) instead of re-supplying summary/start/end/description every time.
- **Change ID:** calendar-partial-update
- **PRD refs:** US-01, FR-001
- **Prerequisites:** S-01
- **Parallel with:** S-08, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** Merge rules for all-day vs timed events and timezone fields when only a subset is provided.
- **Risk:** CalDAV replaces whole `.ics` resources; without an explicit merge path, Update stays awkward for automation authors.
- **Status:** proposed

### S-02: Shared OAuth2 credential

- **Outcome:** user can create and use a shared Nextcloud OAuth2 credential across suite nodes, proven against Calendar.
- **Change ID:** shared-oauth2-credential
- **PRD refs:** FR-002
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Same must-have priority as Basic Auth in the PRD; sequenced immediately after the north star so quality does not leave OAuth as an afterthought.
- **Status:** proposed

### S-03: Nextcloud Files/Drive

- **Outcome:** user can automate Nextcloud Files/Drive at legacy-standard coverage (file/folder/share-style operations).
- **Change ID:** nextcloud-files-drive
- **PRD refs:** FR-004
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Addresses the thin core file pain; kept vertical and parallel with other suite apps so Files depth does not block Deck/Talk/News.
- **Status:** done

### S-04: Nextcloud Deck

- **Outcome:** user can automate Nextcloud Deck boards and cards.
- **Change ID:** nextcloud-deck
- **PRD refs:** FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Author-priority suite app; parallel after shared credential to avoid serializing the whole suite.
- **Status:** done

### S-10: Deck partial card update (safe merge)

- **Outcome:** user can Update a Deck card without sending the full GET entity back on PUT — node whitelists writable fields (`title`, `description`, `duedate`, `type`, `order`) via a `buildCardUpdatePayload` helper, mirroring board update and S-09 Calendar partial-update pattern.
- **Change ID:** deck-partial-update
- **PRD refs:** FR-005
- **Prerequisites:** S-04
- **Parallel with:** S-08, S-09, S-02, S-03, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** Exact writable field set across Deck API versions; nested/read-only fields on card GET responses.
- **Risk:** Current card Update uses `mergeDefined` on the full GET payload; read-only or nested fields may cause PUT failures or silent clobbering until this lands.
- **Status:** proposed

### S-05: Nextcloud Talk

- **Outcome:** user can automate Nextcloud Talk.
- **Change ID:** nextcloud-talk
- **PRD refs:** FR-006
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Webhook-related value is parked (FR-010); Talk still ships as a must-have node without waiting on webhooks.
- **Status:** proposed

### S-06: Nextcloud News

- **Outcome:** user can automate Nextcloud News.
- **Change ID:** nextcloud-news
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Author-priority niche app; kept as its own vertical slice so it neither blocks nor hides inside Files.
- **Status:** proposed

### S-07: Suite polling triggers

- **Outcome:** user can use polling triggers for suite changes.
- **Change ID:** suite-polling-triggers
- **PRD refs:** FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Top trigger priority in the PRD; starts once Calendar exists and expands as suite apps land — do not wait for every app before the first polling path.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | local-community-node-verify | Make package runnable via local n8n community-node link | yes | Run `/10x-plan local-community-node-verify` — unlocks north star |
| S-01 | shared-basic-auth-calendar | Shared Basic Auth + Nextcloud Calendar (+ resource pickers) | no | After F-01 |
| S-08 | calendar-get-many-caldav | Reliable Calendar Get Many (CalDAV query / paging) | no | After S-01; observed PROPFIND truncation |
| S-09 | calendar-partial-update | Calendar Update with only changed fields | no | After S-01; GET→merge→PUT |
| S-02 | shared-oauth2-credential | Shared Nextcloud OAuth2 credential (prove on Calendar) | no | After S-01; parallel with suite apps |
| S-03 | nextcloud-files-drive | Nextcloud Files/Drive legacy-standard node | no | After S-01; parallel suite |
| S-04 | nextcloud-deck | Nextcloud Deck boards/cards node | no | After S-01; parallel suite |
| S-10 | deck-partial-update | Deck Update with whitelisted writable fields | no | After S-04; safe GET→merge→PUT |
| S-05 | nextcloud-talk | Nextcloud Talk node | no | After S-01; webhooks parked |
| S-06 | nextcloud-news | Nextcloud News node | no | After S-01; parallel suite |
| S-07 | suite-polling-triggers | Polling triggers for Nextcloud suite changes | no | After S-01; expands with apps |

## Investigations

### Cross-node `resource` parameter index audit

- **Source:** Bugbot review 2026-07-19 — `nodes/NextcloudDeck/NextcloudDeck.node.ts:130-134`
- **Issue:** `execute` reads `resource` via `getNodeParameter('resource', 0)` while every other parameter uses loop index `i`. In multi-item runs where `resource` is driven by an expression, every item is dispatched using the first item's resource.
- **Scope:** Audit all suite node `execute` implementations (`NextcloudDeck`, `NextcloudFiles`, `NextcloudCalendar`, and future nodes).
- **Known baseline (2026-07-19):** `NextcloudDeck` uses index `0`; `NextcloudFiles` uses index `i`; `NextcloudCalendar` has no `resource` parameter.

## Open Roadmap Questions

1. **What is the minimum supported Nextcloud version (if any)?** — Owner: user. Block: none (does not gate planning).

## Parked

- **Contacts automation (FR-007)** — Why parked: PRD nice-to-have; demoted during shaping.
- **Webhook triggers (FR-010)** — Why parked: nice-to-have relative to polling; related to Talk but not required to ship Talk.
- **npm publish as a primary gate** — Why parked: Secondary Success Criteria; local community-node verification comes first (FR-003).
- **Google-only mirrors with no Nextcloud counterpart** — Why parked: PRD §Non-Goals.
- **Replacing or patching core n8n `nodes-base` Nextcloud** — Why parked: PRD §Non-Goals; community package only.
- **Windmill workflows** - Why parked: Don't know if relevant at all, see: https://docs.nextcloud.com/server/latest/admin_manual/windmill_workflows/index.html

## Done

- **F-01: (foundation) package builds and runs via the local n8n community-node path so suite work can be verified before npm publish.** — Archived 2026-07-18 → `context/archive/2026-07-18-local-community-node-verify/`. Lesson: —.
- **S-01: user can create a shared Nextcloud Basic Auth credential, run Calendar event operations with useful workflow outputs, and pick remote resources via loaded lists with manual-input fallback — without secrets in outputs or errors.** — Archived 2026-07-18 → `context/archive/2026-07-18-shared-basic-auth-calendar/`. Lesson: —.
- **S-04: user can automate Nextcloud Deck boards and cards.** — Archived 2026-07-18 → `context/archive/2026-07-18-nextcloud-deck/`. Lesson: —.
- **S-03: user can automate Nextcloud Files/Drive at legacy-standard coverage (file/folder/share-style operations).** — Archived 2026-07-18 → `context/archive/2026-07-18-nextcloud-files-drive/`. Lesson: —.
