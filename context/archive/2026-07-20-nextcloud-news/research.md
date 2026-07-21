---
date: 2026-07-20T10:44:19Z
researcher: kacpergolasz
git_commit: 8c5e47bea68ec0e4669b3681bb06b52a42a57c39
branch: nextcloud-news
repository: n8n-nodes-nextcloud
topic: "Nextcloud News API (v1.3 surface, auth, sibling node patterns)"
tags: [research, codebase, nextcloud-news, news-api, deck-patterns, basic-auth]
status: complete
last_updated: 2026-07-20
last_updated_by: kacpergolasz
---

# Research: Nextcloud News API (v1.3 surface, auth, sibling node patterns)

**Date**: 2026-07-20T10:44:19Z
**Researcher**: kacpergolasz
**Git Commit**: 8c5e47bea68ec0e4669b3681bb06b52a42a57c39
**Branch**: nextcloud-news
**Repository**: n8n-nodes-nextcloud

## Research Question

Focus on getting data about the Nextcloud News API (detailed coverage), plus how sibling Nextcloud nodes in this package structure API calls. Attach documentation URLs.

## Summary

- **Ship against API v1.3**, not v2. Official developer docs state only V1 is fully implemented; V2 is a draft with low-priority work in progress.
- **Auth is HTTP Basic Auth** on every request (`Authorization: Basic base64(USER:PASSWORD)`). Prefer Nextcloud **app passwords**. Matches this package’s shared `nextcloudApi` credential. Bearer/OIDC tokens are not supported by News (`CORS requires basic auth` reported for Bearer).
- **Base URL**: `{baseUrl}/index.php/apps/news/api/v1-3/` (JSON REST; not OCS-wrapped, not WebDAV).
- **Core resources**: Folders, Feeds, Items (+ version/status; updater routes are admin-only and out of typical automation scope).
- **Closest local template**: `NextcloudDeck` — JSON REST under `/index.php/apps/.../api/...` with a centralized `*Request` helper and `resources/<resource>/` operation files. No `NextcloudNews` code exists yet.
- **Product placement**: FR-008 / roadmap S-06 — separate panel node, shared Basic Auth credential, after S-01.

## Official documentation (URLs)

| Doc | URL | Notes |
| --- | --- | --- |
| News docs home | https://nextcloud.github.io/news/ | User / admin / developer hub |
| Developer APIs overview | https://nextcloud.github.io/news/developer/ | **V1 fully implemented; V2 not** |
| **API v1.3 (canonical for this change)** | https://nextcloud.github.io/news/api/api-v1-3/ | Folders / feeds / items / sync guidance |
| API v2 (draft) | https://nextcloud.github.io/news/api/api-v2/ | Incomplete; do not target for MVP |
| API v1.2 (legacy) | https://github.com/nextcloud/news/blob/master/docs/api/api-v1-2.md | Superseded by v1.3 |
| App source / routes | https://github.com/nextcloud/news | Controllers under `lib/Controller/`; routes in `appinfo/routes.php` |
| Changelog (API notes) | https://github.com/nextcloud/news/blob/master/CHANGELOG.md | v1.3 starring-by-id; later feed filter routes |

Third-party protocol notes (not authoritative, useful for edge cases): https://thearsse.com/manual/en/Supported_Protocols/Nextcloud_News.html

## Detailed Findings

### 1. Authentication & transport

- Stateless REST: credentials on **every** request; SSL strongly recommended by upstream.
- Header: `Authorization: Basic base64(USER:PASSWORD)`.
- CORS exists for browser clients; auth must be a real Basic header (not credentials in URL).
- **No OAuth / Bearer** on News today. Aligns with this package deferring OAuth2 to S-02 and using shared Basic Auth + app password.
- Local credential already matches (`credentials/NextcloudApi.credentials.ts`): `username` + `appPassword` via n8n generic Basic Auth; test hits `{baseUrl}/status.php`.

### 2. API version choice

| Version | Base path | Status | Recommendation |
| --- | --- | --- | --- |
| v1.3 | `/index.php/apps/news/api/v1-3/` | Fully implemented | **Use this** |
| v1.2 | `/index.php/apps/news/api/v1-2/` | Legacy | Avoid for new work |
| v2 | `/index.php/apps/news/api/v2` | Draft / incomplete | Defer |

Stability contract (v1.3): additive fields OK; removals/datatype/meaning changes bump API level. Clients must ignore unknown JSON fields and not rely on key order.

### 3. Sync model (client guidance from upstream)

**Initial sync** (four calls — do **not** fetch all historical articles):

1. `GET /items?type=3&getRead=false&batchSize=-1` — unread
2. `GET /items?type=2&getRead=true&batchSize=-1` — starred
3. `GET /folders`
4. `GET /feeds`

**Ongoing sync**: push read/unread/star state, then refresh folders/feeds and `GET /items/updated?lastModified=…&type=3`.

For n8n automation (not a full sync client), expose CRUD-style operations that map 1:1 to REST routes; optional “list unread / list starred” presets can encode the recommended query params.

### 4. API v1.3 endpoint catalogue

Base: `https://{host}/index.php/apps/news/api/v1-3`

Input convention: GET → query params; POST/PUT/DELETE → JSON body (framework also accepts params interchangeably).

#### Folders

| Operation | Method | Route | Body / notes | Errors |
| --- | --- | --- | --- | --- |
| List | GET | `/folders` | — | — |
| Create | POST | `/folders` | `{ "name" }` | 409 exists, 422 invalid |
| Delete | DELETE | `/folders/{folderId}` | deletes folder **and** its feeds | 404 |
| Rename | PUT | `/folders/{folderId}` | `{ "name" }` | 404 / 409 / 422 |
| Mark folder read | POST | `/folders/{folderId}/read` | `{ "newestItemId" }` | 404 |

List response shape: `{ "folders": [ { "id", "name" } ] }`.

#### Feeds

| Operation | Method | Route | Body / notes | Errors |
| --- | --- | --- | --- | --- |
| List | GET | `/feeds` | also returns `starredCount`, optional `newestItemId` | — |
| Create | POST | `/feeds` | `{ "url", "folderId" }` (`folderId` null = root) | 409 / 422 |
| Delete | DELETE | `/feeds/{feedId}` | deletes feed + items | 404 |
| Move | POST | `/feeds/{feedId}/move` | `{ "folderId" }` | 404 |
| Rename | POST | `/feeds/{feedId}/rename` | `{ "feedTitle" }` | 404 |
| Mark feed read | POST | `/feeds/{feedId}/read` | `{ "newestItemId" }` | 404 |

Feed object fields (non-exhaustive; ignore unknown): `id`, `url`, `title`, `faviconLink`, `added`, `nextUpdateTime`, `folderId`, `unreadCount`, `ordering` (0/1/2), `link`, `pinned`, `updateErrorCount`, `lastUpdateError`.

**XSS note**: `title` and `link` are **not** sanitized by the API.

Changelog also documents feed keyword filters: `GET|POST|DELETE /feeds/{feedId}/filter` (newer than the static v1.3 page — verify against installed News version before planning as MVP).

#### Items

Query type enum for list/updated:

| `type` | Meaning | `id` |
| --- | --- | --- |
| 0 | Feed | feed id |
| 1 | Folder | folder id |
| 2 | Starred | use `0` |
| 3 | All | use `0` |

| Operation | Method | Route | Notes |
| --- | --- | --- | --- |
| List | GET | `/items` | `batchSize` (default -1 = all), `offset` (item id cursor), `type`, `id`, `getRead`, `oldestFirst` |
| List updated | GET | `/items/updated` | `lastModified`, `type`, `id` — includes status-only changes |
| Mark read | POST | `/items/{itemId}/read` | 404 if missing |
| Mark unread | POST | `/items/{itemId}/unread` | |
| Mark read (bulk) | POST | `/items/read/multiple` | `{ "itemIds": [...] }` |
| Mark unread (bulk) | POST | `/items/unread/multiple` | `{ "itemIds": [...] }` |
| Star | POST | `/items/{itemId}/star` | API 1.3 |
| Unstar | POST | `/items/{itemId}/unstar` | API 1.3 |
| Star (bulk) | POST | `/items/star/multiple` | `{ "itemIds": [...] }` |
| Unstar (bulk) | POST | `/items/unstar/multiple` | `{ "itemIds": [...] }` |
| Mark all read | POST | `/items/read` | `{ "newestItemId" }` |

Item fields (core): `id`, `guid`, `guidHash`, `url`, `title`, `author`, `pubDate`, `body`, `enclosureMime`, `enclosureLink`, `mediaThumbnail`, `mediaDescription`, `feedId`, `unread`, `starred`, `rtl`, `lastModified`, `fingerprint`, …

**XSS note**: many string fields (`title`, `author`, `url`, `body`-adjacent enclosure/media fields) are unsanitized — relevant if any future UI renders HTML; n8n JSON output should pass through as data.

**Pagination**: server uses `batchSize` + `offset` (item id), not page numbers. Sibling Deck/Files nodes mostly fetch-all then client-limit; News can either map `batchSize`/`offset` to UI or follow the local `returnAll`/`limit` convention on top of `batchSize=-1`.

#### Misc

| Operation | Method | Route | Notes |
| --- | --- | --- | --- |
| Version | GET | `/version` | `{ "version" }` — good credential/smoke probe for News app presence |
| Status | GET | `/status` | cron / DB charset warnings |
| Favicon | GET | `/favicon/{feedUrlHash}` | md5 of feed URL; image/* |
| User | GET | `/user` | **Deprecated** — use Nextcloud OCS user metadata instead |
| Updater / cleanup / `feeds/all` | GET | various | **Admin-only** — exclude from default user automation MVP |

### 5. Doc inconsistencies to verify at implement time

The v1.3 “How To Sync” section shows **PUT** and body keys like `"items"` / `/items/starred/multiple`, while the detailed endpoint section documents **POST**, `"itemIds"`, and `/items/star/multiple` / `/unstar/multiple`. Prefer the **detailed endpoint** definitions; confirm against a live News instance or `appinfo/routes.php` before locking the node.

### 6. Sibling node patterns (this package)

No News implementation yet. Patterns to mirror:

| Concern | Pattern | Primary reference |
| --- | --- | --- |
| Credential | Reuse `nextcloudApi` (no News-specific credential) | `credentials/NextcloudApi.credentials.ts` |
| Layout | `nodes/NextcloudNews/` + `GenericFunctions.ts` + `resources/<resource>/` + `listSearch/` + `shared/` + Vitest | Deck / Files / Calendar |
| JSON REST helper | `newsApiBase` + `newsRequest` via `httpRequestWithAuthentication(..., 'nextcloudApi')` | `nodes/NextcloudDeck/GenericFunctions.ts` (`deckApiBase` ~L20–22, `deckRequest` ~L86–104) |
| Headers | Centralize in helper; Deck sends `OCS-APIRequest` + JSON — News docs require JSON Accept/Content-Type for v2; for v1.3 use `json: true` and confirm whether `OCS-APIRequest` is needed (likely optional; verify live) | Deck helper |
| Execute | Thin `*.node.ts`, per-item try/catch, scrub secrets, `NodeApiError` / continue-on-fail | All three nodes |
| Pickers | `resourceLocator` + `listSearch` (FR-011) | Deck boards/stacks; Files folders |
| getAll | `returnAll` + `limit` (client-side) unless News `batchSize` is exposed intentionally | Deck `card/getAll` |
| Protocol mismatch | Do **not** copy Calendar CalDAV or Files WebDAV | Calendar / Files |

Existing suite resources (for scope comparison):

- **Deck**: card, board, stack
- **Files**: file, folder, share
- **Calendar**: event

Suggested News resources for planning: **folder**, **feed**, **item** (mark read/star as item operations).

### 7. Product / historical context

- `context/foundation/prd.md` FR-008: automate Nextcloud News (must-have).
- `context/foundation/roadmap.md` S-06 `nextcloud-news`: depends on S-01 (shared Basic Auth); parallel with other suite apps.
- Archive (Deck / Files / Calendar): shared credential proven; centralize headers; scrub `appPassword`; use loop index `i` in `getNodeParameter`; unknown resource/operation must throw; vertical MVP then follow-ups.
- zahidcoder frame: rewrite on local scaffold; **no News** coverage there either — use only as unrelated endpoint cheat-sheet if needed.
- **No prior News API URL** was recorded in context before this research.

## Code References

- `credentials/NextcloudApi.credentials.ts:49-63` — shared Basic Auth + `status.php` test
- `nodes/NextcloudDeck/GenericFunctions.ts:20-22` — `deckApiBase` → `/index.php/apps/deck/api/v1.0` (News analogue: `/index.php/apps/news/api/v1-3`)
- `nodes/NextcloudDeck/GenericFunctions.ts:86-104` — `deckRequest` + auth + JSON headers
- `nodes/NextcloudDeck/resources/card/create.ts` — thin operation calling `deckRequest`
- `context/foundation/prd.md` — FR-008 News
- `context/foundation/roadmap.md` — S-06 nextcloud-news
- `context/archive/2026-07-18-nextcloud-deck/` — JSON app-node plan/review lessons
- `context/archive/2026-07-18-shared-basic-auth-calendar/` — shared credential foundation

## Architecture Insights

1. News is a **JSON REST app API**, same family as Deck — not OCS envelope, not DAV.
2. Prefer **app password + Basic Auth** through existing `nextcloudApi`; News app must be enabled on the instance.
3. Design for **additive JSON fields** and ignore unknowns.
4. Automation MVP should prioritize folder/feed CRUD + item list + mark read/unread/star — not admin updater or deprecated `/user`.
5. Item listing already has a first-class cursor (`offset` = item id); decide in planning whether to expose it or wrap with local `returnAll`/`limit`.
6. Treat HTML body / title fields as opaque data (XSS if rendered elsewhere).

## Historical Context (from prior changes)

- `context/archive/2026-07-18-shared-basic-auth-calendar/` — established `nextcloudApi`; News must attach, not reinvent.
- `context/archive/2026-07-18-nextcloud-deck/` — best structural template for News; header centralization and scrub lessons.
- `context/archive/2026-07-18-nextcloud-files-drive/` — OCS unwrap patterns **not** needed for News unless a future OCS route appears.
- `context/changes/zahidcoder-adopt-or-rewrite/frame.md` — do not fork; News is a coverage gap there too.

## Related Research

- None under `context/**/research.md` prior to this document.

## Open Questions

1. Confirm live method/body for bulk star/read routes (sync overview vs detailed endpoint table).
2. Does News require `OCS-APIRequest: true` like Deck, or only JSON Accept/Content-Type?
3. Minimum News app version to require for v1.3 star-by-id + any feed `/filter` ops.
4. MVP resource cut: include folder mark-read / feed move-rename, or defer?
5. Whether `GET /version` or `GET /status` should be a dedicated node operation vs internal smoke only.
6. How `index.php` vs pretty-URL installs affect base path (same issue as Deck — likely `{baseUrl}/index.php/apps/news/api/v1-3` with optional rewrite variants to verify).
