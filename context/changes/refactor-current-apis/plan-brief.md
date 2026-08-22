# Suite API client + repository refactor — Plan Brief

> Full plan: `context/changes/refactor-current-apis/plan.md`

## What & Why

The suite still mixes two API styles: **NextcloudDeck** already uses typed clients, Zod repositories, and `Maybe<T>` — while **News, Files, and Calendar** call HTTP directly from `GenericFunctions.ts`. This change migrates those action nodes (then their triggers) to the Deck pattern so API boundaries are testable, doc-driven, and consistent before cross-cutting work like pagination (S-08) and partial update (S-09).

## Starting Point

- **Done:** `NextcloudDeck` — `deck.client.ts`, `repositories/`, `context/api/documentation/` (reference only).
- **Legacy:** `NextcloudNews` (~349 LOC GenericFunctions), `NextcloudFiles` (~795 LOC, WebDAV + OCS), `NextcloudCalendar` (~447 LOC CalDAV + separate `ics/` module).
- **Triggers:** `NextcloudNewsTrigger` and `NextcloudFilesTrigger` import parent GenericFunctions HTTP helpers.

## Desired End State

Each action node has documentation → client → repositories → thin resources. `GenericFunctions.ts` holds n8n glue only (client factory, pickers, resolvers). Shared `Maybe` helpers live in `nodes/shared/`. Triggers call parent repositories. Workflow outputs and UI unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Deck scope | Skip — reference only | Already migrated; Phase 0 only repoints shared imports | Plan |
| App scope | Action nodes in Phases 1–3 | Triggers depend on parent repos landing first | Plan |
| Migration order | News → Files → Calendar | REST first builds confidence; CalDAV is hardest | Plan |
| Shared helpers | Extract to `nodes/shared/` | One `Maybe` contract across suite | Plan |
| GenericFunctions fate | Slim to n8n glue | Keeps listSearch/payload builders; removes HTTP | Plan |
| Calendar ICS boundary | Client/repos = CalDAV/XML; `ics/` = RFC 5545 | Prevents mixing transport and domain logic | Plan |
| Triggers | Phase 4 after action nodes | Rewire polls to repositories once parents exist | Plan |
| Per-app sub-steps | docs → client → repos → refactor | Matches api-documentation / api-client / api-repositories skills | Plan |

## Scope

**In scope:**

- Phase 0: shared `Maybe` helpers + Deck import update
- Phases 1–3: full migration for NextcloudNews, NextcloudFiles, NextcloudCalendar
- Phase 4: NextcloudNewsTrigger + NextcloudFilesTrigger
- Client + repository unit tests per node

**Out of scope:**

- NextcloudDeck feature work
- Talk / Tasks / Contacts
- News API v2, S-08 pagination envelope, S-09 partial-update suite helpers
- Node UI / credential changes

## Architecture / Approach

```
Resource handler  →  unwrapResult(repo fn(client, opts))  →  *Client  →  n8n httpRequestWithAuthentication
                              ↑
                    Zod schema in *.repository.ts
                              ↑
              nodes/<Node>/context/api/documentation/openapi.md
```

Each app phase runs the three API skills in order, then refactors resources. Calendar adds an explicit review gate: **no ICS logic in the client; no HTTP in `ics/`.**

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Shared helpers | `nodes/shared/apiResult.ts`; Deck repointed | Low — mechanical extract |
| 1. NextcloudNews | news.client + 3 repos + resource refactor | Low — mirrors Deck REST |
| 2. NextcloudFiles | files.client + WebDAV/OCS repos | Medium — dual protocol + binary upload |
| 3. NextcloudCalendar | calendar.client + repos; `ics/` untouched | High — CalDAV XML + ICS boundary |
| 4. Triggers | Poll via parent repositories | Medium — pagination mock updates |

**Prerequisites:** F-02 (validation) done; Deck reference on branch; local n8n verify path (F-01).

**Estimated effort:** ~5 phases, ~1 session each for News/Files, ~1–2 for Calendar, half session for Phase 0 + 4.

## Open Risks & Assumptions

- Files client must support WebDAV methods (PROPFIND, MOVE, COPY, MKCOL) — not in default REST client skill sample; extend per openapi.md.
- Calendar multistatus parsing moves to repositories — regression risk on getAll date filters; existing `getAll.test.ts` is the guard.
- Phase 3 manual review of ICS boundary is required before Phase 4 (user-requested checkpoint).

## Success Criteria (Summary)

- All suite action nodes use client + repository pattern; no raw HTTP in GenericFunctions.
- `npm run lint:safety`, `npm run test`, `npm run build` pass after every phase.
- Local n8n smoke tests pass per node; Calendar ICS boundary verified at Phase 3 review.
