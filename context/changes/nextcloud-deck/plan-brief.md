# Nextcloud Deck (boards/cards) — Plan Brief

> Full plan: `context/changes/nextcloud-deck/plan.md`
> Frame brief: `context/changes/zahidcoder-adopt-or-rewrite/frame.md` (architecture: rewrite + port Calendar patterns; zahidcoder = endpoint reference only)

## What & Why

Deliver roadmap S-04 / FR-005: a separate **Nextcloud Deck** node that automates Deck boards and cards (stacks as a supporting concept), reusing the shared `nextcloudApi` Basic Auth credential. It is the second suite app after Calendar and the first proof the shared-credential contract generalizes from CalDAV to Nextcloud's JSON app APIs.

## Starting Point

After S-01, the package ships one credential (`nextcloudApi`) and one node (`Nextcloud Calendar`) with a modular layout — `GenericFunctions`, `listSearch/`, `resources/`, `shared/` (scrubbing + status), and Vitest. Deck's REST API (`{baseUrl}/index.php/apps/deck/api/v1.0`, header `OCS-APIRequest: true`) is plain JSON, so it reuses the credential, auth transport, scrubber, and status helpers with no XML/ICS parsing.

## Desired End State

An author finds **Nextcloud Deck** in the panel, attaches the same `Nextcloud API` credential as Calendar, and runs Board (Create/Get/Get Many/Update/Delete), Stack (Get Many/Create), and Card (Create/Get/Get Many/Update/Delete/Move) operations — choosing a board (and board-dependent stack) from loaded lists or by id. Outputs are useful JSON; secrets never leak; the package registers both Calendar and Deck nodes; unit tests pass; the F-01 link path still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Resource scope | Board + Card first-class; Stack minimal (Get Many + Create) | Scope is boards/cards; stacks only as needed to place cards | Plan |
| API surface | Deck REST at `index.php/apps/deck/api/v1.0` + `OCS-APIRequest: true` | Returns plain JSON; header is mandatory and centralized in one helper | Plan |
| Card Get Many | Fetch board stacks, flatten nested `cards[]`, client-side limit | No flat list-cards endpoint exists in Deck | Plan |
| Card placement | Include a Card **Move** op via `…/reorder` (order + target stack) | Moving cards between stacks is the core Deck automation use case | Plan |
| Update semantics | GET → merge → PUT for board & card updates | Deck PUT expects a full object; partial PUT risks clobbering/400 | Plan |
| Resource pickers | Board locator (list) + board-dependent Stack locator (list) + manual id | FR-011; stack listSearch reads selected board from node params | Plan |
| Deferred card ops | Labels/users/comments/attachments/ACL out of scope | Keeps S-04 shippable in the after-hours budget | Plan |
| Shared helpers | Copy `scrubSecrets`/`httpStatus` into Deck's `shared/` | Keeps node self-contained, matching the current per-node layout | Plan |
| Tests | Vitest: URL builders + card flatten + merge + scrub; no live NC in CI | Locks logic; Phase 3 is the real-instance proof | Plan |

## Scope

**In scope:** `Nextcloud Deck` node reusing `nextcloudApi`; Board CRUD; Stack Get Many + Create; Card CRUD + Move; board + dependent-stack pickers (FR-011); secret scrubbing; unit tests; node registration alongside Calendar; F-01 + real-NC manual smoke.

**Out of scope:** OAuth2 (S-02); Files/Talk/News; triggers; label/user/comment/attachment card ops, ACL/sharing, board import, sessions; credential changes; live NC in CI; npm publish; zahidcoder fork.

## Architecture / Approach

New self-contained `nodes/NextcloudDeck/` tree mirroring `NextcloudCalendar/`. A `deckRequest` helper centralizes the Deck base path, `OCS-APIRequest: true` header, and JSON body over `httpRequestWithAuthentication('nextcloudApi', …)`. Programmatic `execute()` dispatches board/stack/card ops with a per-item try/catch that scrubs secrets and maps HTTP status. Board and stack `listSearch` methods feed `resourceLocator` pickers; the stack picker is board-dependent.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scaffold + Board | Deck node, REST helper, board CRUD + picker, tests, registration | Forgetting `OCS-APIRequest` header → silent Deck failures |
| 2. Stack + Card | Stack Get Many/Create, Card CRUD + Move, dependent stack picker | Dependent stack picker + card-flatten Get Many correctness |
| 3. Local verification | Real-NC smoke of all ops, pickers, redaction | Needs reachable Nextcloud with Deck app enabled |

**Prerequisites:** S-01 done (credential + Calendar + Vitest present); a Nextcloud instance with the Deck app for Phase 3; Node/npm for build/link.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Deck app must be enabled on the target Nextcloud; API version assumed v1.0 (v1.1 attachments not used this slice).
- `duedate` handling assumes ISO-8601 or null; timezone edge cases accepted for MVP.
- Copying `scrubSecrets`/`httpStatus` duplicates two small helpers across nodes — a package-level shared util could dedupe later (deferred, not blocking).
- Board vs OCS endpoint choice: plan uses the `index.php` REST endpoint (unwrapped JSON); if a target instance only exposes the OCS wrapper, response unwrapping (`ocs.data`) would need adding.

## Success Criteria (Summary)

- Shared `Nextcloud API` credential (same as Calendar) authorizes Deck; Board/Stack/Card ops produce useful items on a real Nextcloud.
- Board picker (list + manual) and board-dependent stack picker both work; Card Move relocates cards between stacks.
- No `appPassword` in errors; build/lint/unit tests pass; package registers both Calendar and Deck nodes.
