# Shared Basic Auth + Nextcloud Calendar — Plan Brief

> Full plan: `context/changes/shared-basic-auth-calendar/plan.md`
> Frame brief: `context/changes/zahidcoder-adopt-or-rewrite/frame.md` (architecture: rewrite + port prior art)

## What & Why

Deliver roadmap north star S-01: one shared Nextcloud Basic Auth credential and a Calendar node that produces useful event outputs with list-or-type resource pickers — proving the suite credential contract before other apps.

## Starting Point

Active package is starter-only (Example/GithubIssues) with F-01 local link verify already working. CalDAV prior art lives in `packages/nextcloud backup/calendar/` (`nextcloudApi` + event CRUD + pickers) but has no secret scrubbing and is not registered in the active package.

## Desired End State

Author creates `Nextcloud API` credential, runs Nextcloud Calendar Create/Get/Get Many/Update/Delete with list or manual calendar selection, gets useful items, and never sees `appPassword` in errors. Package ships only that credential + Calendar; unit tests cover helpers and scrubbing; F-01 link path still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Sequencing | Soft split: credential then Calendar | Two deliverables, one north-star proof; live credential Test after Calendar | Plan |
| Ops surface | Full prior-art CRUD + getAll | Port completeness; proves useful outputs immediately | Plan |
| Secret scrubbing | Defensive scrub on Calendar error paths | Closes PRD gap without suite-wide abstraction yet | Plan |
| Canaries | Remove Example + GithubIssues with Calendar registration | Nextcloud-only package in one cutover | Plan |
| Tests | Vitest: helpers + scrubber; no live NC in CI | Locks parsers/redaction; Phase 3 is the real-instance proof | Plan |
| Layout | Modular (listSearch/resources/shared) + programmatic execute | Matches starter conventions; CalDAV unfit for declarative routing | Plan |
| Credential fields | Keep `baseUrl` / `username` / `appPassword` | Proven against Nextcloud CalDAV paths | Plan |

## Scope

**In scope:** `nextcloudApi` Basic Auth; Nextcloud Calendar event ops + FR-011 pickers; scrubber; Vitest; canary removal; README verify tip update; F-01 + real-NC manual smoke.

**Out of scope:** OAuth2; other suite apps; triggers; zahidcoder fork; ICS TZ fixes; CI live NC; npm publish; full README_TEMPLATE rewrite.

## Architecture / Approach

Port credential 1:1, then reshape-port Calendar under `nodes/NextcloudCalendar/` with shared Basic Auth via `httpRequestWithAuthentication`. Scrub secrets at the node error boundary. Atomic `package.json` cutover swaps canaries for Calendar. Manual Phase 3 runs credential Test and CRUD against a real Nextcloud.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared Basic Auth credential | `nextcloudApi` registered beside canaries | Credential unused until Calendar — intentional soft gap |
| 2. Calendar + tests + cutover | Modular Calendar, scrubber, Vitest, canaries gone | Atomic registration must not leave zero nodes |
| 3. North-star local verification | Real NC Test + CRUD + picker + redaction check | Needs reachable Nextcloud + correct CalDAV username |

**Prerequisites:** F-01 complete; access to prior art folder; a Nextcloud instance for Phase 3; Node/npm for build/link.
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks & Assumptions

- CalDAV username is the path user id (may differ from login email) — credential copy must stay clear
- Prior-art ICS timezone behavior is accepted for S-01
- npm name collision with existing published packages is deferred past this change

## Success Criteria (Summary)

- Shared Basic Auth credential works with Calendar (Test + ops) on real Nextcloud
- List and manual calendar pickers both work; full event CRUD yields useful items
- No `appPassword` in errors; build/lint/unit tests pass; package is Nextcloud-only
