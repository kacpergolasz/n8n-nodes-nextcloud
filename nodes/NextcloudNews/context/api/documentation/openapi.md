# Nextcloud News API — OpenAPI-structured reference

> Restructured from the official API documentation ([nextcloud/news `docs/development/api/api-v1-3.md`](https://github.com/nextcloud/news/blob/master/docs/development/api/api-v1-3.md)) into an OpenAPI-like structure. No official OpenAPI/Swagger YAML is published for the News app; this markdown mirrors the OpenAPI layout (info, servers, security, paths, schemas).

## Info

- **Title:** Nextcloud News External API
- **API version:** v1-3 (current stable HTTP methods; v1-2 legacy; v2 partial)
- **Description:** RESTful sync API for RSS/Atom folders, feeds, and items. Used by mobile/desktop clients and this n8n node.
- **Source:** https://github.com/nextcloud/news/blob/master/docs/development/api/api-v1-3.md (retrieved 2026-08-22)

## Servers

| Server | Base URL | Notes |
| --- | --- | --- |
| News REST v1-3 | `https://{nextcloud-host}/index.php/apps/news/api/v1-3` | Primary API for this node |

## Security

### Authorization

- **HTTP Basic Auth** with username and app password (Nextcloud standard). Credentials sent on every request.
- **OAuth2 Bearer token** is also accepted by Nextcloud when configured.
- SSL strongly recommended (credentials otherwise visible on the wire).

### Required headers (JSON routes)

| Header | Value | Notes |
| --- | --- | --- |
| `Accept` | `application/json` | JSON responses |
| `Content-Type` | `application/json` | POST/PUT bodies |

Favicon GET uses `Accept: */*` and returns raw image bytes (not JSON).

### Global responses

| Status | Meaning |
| --- | --- |
| `404` | Folder / feed / item not found |
| `409` | Conflict (folder or feed already exists) |
| `422` | Invalid input (empty folder name, unreadable feed URL, etc.) |

### Formats

- **Timestamps:** Unix epoch seconds for `added`, `pubDate`, and similar item/feed fields.
- **IDs:** Positive integers.
- **Query params on GET:** sent as query string (documented as JSON objects in upstream prose).

## Implementation notes (this node)

1. **Create envelopes.** Folder/feed create returns `{ folders: [...] }` / `{ feeds: [...] }`; take the first element.
2. **Bulk item actions.** v1-3 uses `POST /items/{action}/multiple` with body `{ "itemIds": [...] }` (not the sync-overview `PUT` examples).
3. **Favicon.** `GET /favicon/{feedUrlHash}` where `feedUrlHash` is the MD5 hex digest of the feed URL; response is binary (`encoding: arraybuffer`).
4. **Rename folder.** Official docs say rename returns nothing; live clients may still receive a folder envelope — treat empty as success and fall back to `{ id, name }` when needed.
5. **API stability.** New JSON attributes may appear; clients must ignore unknown fields (do not depend on attribute order).

## Paths / Endpoints

All paths are relative to the News REST v1-3 base URL. Parameters are required unless marked optional.

### Folders

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/folders` | List folders | — | — | 200: `{ folders: [Folder] }` |
| POST | `/folders` | Create folder | — | `name` (String) | 200: `{ folders: [Folder] }` / 409 / 422 |
| PUT | `/folders/{folderId}` | Rename folder | path: `folderId` | `name` (String) | 200 (empty) / 404 / 409 / 422 |
| DELETE | `/folders/{folderId}` | Delete folder and its feeds | path: `folderId` | — | 200 (empty) / 404 |
| POST | `/folders/{folderId}/read` | Mark folder items read | path: `folderId` | `newestItemId` (Integer) | 200 (empty) / 404 |

### Feeds

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/feeds` | List feeds | — | — | 200: `{ feeds: [Feed], starredCount?, newestItemId? }` |
| POST | `/feeds` | Create feed | — | `url` (String), `folderId` (Integer\|null, optional) | 200: `{ feeds: [Feed], newestItemId? }` / 409 / 422 |
| DELETE | `/feeds/{feedId}` | Delete feed and items | path: `feedId` | — | 200 (empty) / 404 |
| POST | `/feeds/{feedId}/move` | Move feed to folder | path: `feedId` | `folderId` (Integer\|null) | 200 (empty) / 404 |
| POST | `/feeds/{feedId}/rename` | Rename feed | path: `feedId` | `feedTitle` (String) | 200 (empty) / 404 |
| POST | `/feeds/{feedId}/read` | Mark feed items read | path: `feedId` | `newestItemId` (Integer) | 200 (empty) / 404 |

### Items

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/items` | List items | query: `batchSize` (Integer, default -1), `offset` (Integer), `type` (0 feed / 1 folder / 2 starred / 3 all), `id` (Integer), `getRead` (Bool), `oldestFirst` (Bool, optional) | — | 200: `{ items: [Item] }` |
| POST | `/items/{itemId}/read` | Mark item read | path: `itemId` | — | 200 (empty) / 404 |
| POST | `/items/{itemId}/unread` | Mark item unread | path: `itemId` | — | 200 (empty) / 404 |
| POST | `/items/{itemId}/star` | Star item | path: `itemId` | — | 200 (empty) / 404 |
| POST | `/items/{itemId}/unstar` | Unstar item | path: `itemId` | — | 200 (empty) / 404 |
| POST | `/items/read/multiple` | Mark many read | — | `itemIds` (Integer[]) | 200 (empty) |
| POST | `/items/unread/multiple` | Mark many unread | — | `itemIds` (Integer[]) | 200 (empty) |
| POST | `/items/star/multiple` | Star many | — | `itemIds` (Integer[]) | 200 (empty) |
| POST | `/items/unstar/multiple` | Unstar many | — | `itemIds` (Integer[]) | 200 (empty) |

### Favicon

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/favicon/{feedUrlHash}` | Fetch feed favicon bytes | path: `feedUrlHash` (MD5 hex of feed URL) | — | 200: `image/*` binary |

## Components / Entities

### Entity: Folder

```json
{
  "id": 4,
  "name": "Media"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | integer | Folder id |
| `name` | string | Display name |

### Entity: Feed

```json
{
  "id": 39,
  "url": "http://feeds.feedburner.com/oatmealfeed",
  "title": "The Oatmeal - Comics, Quizzes, & Stories",
  "faviconLink": "http://theoatmeal.com/favicon.ico",
  "added": 1367063790,
  "nextUpdateTime": 2071387335,
  "folderId": 4,
  "unreadCount": 9,
  "ordering": 0,
  "link": "http://theoatmeal.com/",
  "pinned": true,
  "updateErrorCount": 0,
  "lastUpdateError": "error message here"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | integer | Feed id |
| `url` | string | Feed URL |
| `title` | string | Feed title (unsanitized) |
| `faviconLink` | string\|null | Favicon URL |
| `added` | integer | Unix timestamp when added |
| `nextUpdateTime` | integer | Next scheduled update |
| `folderId` | integer\|null | Parent folder (`null` = root) |
| `unreadCount` | integer | Unread item count |
| `ordering` | integer | 0 default, 1 oldest first, 2 newest first |
| `link` | string\|null | Website URL (unsanitized) |
| `pinned` | boolean | Pin before other feeds |
| `updateErrorCount` | integer | Consecutive update failures |
| `lastUpdateError` | string\|null | Last update error message |

List responses may also include top-level `starredCount` and `newestItemId`.

### Entity: Item

```json
{
  "id": 3443,
  "guid": "http://grulja.wordpress.com/?p=76",
  "guidHash": "3059047a572cd9cd5d0bf645faffd077",
  "url": "http://grulja.wordpress.com/2013/04/29/plasma-nm-after-the-solid-sprint/",
  "title": "Plasma-nm after the solid sprint",
  "author": "Jan Grulich (grulja)",
  "pubDate": 1367270544,
  "body": "<p>At first I have to say...</p>",
  "enclosureMime": null,
  "enclosureLink": null,
  "mediaThumbnail": null,
  "mediaDescription": null,
  "feedId": 67,
  "unread": true,
  "starred": false,
  "filtered": false,
  "rtl": false,
  "lastModified": 1367273003,
  "fingerprint": "aeaae2123"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | integer | Item id |
| `guid` | string | Item GUID |
| `guidHash` | string | Hash of GUID |
| `url` | string\|null | Article URL (unsanitized) |
| `title` | string\|null | Title (unsanitized) |
| `author` | string\|null | Author (unsanitized) |
| `pubDate` | integer\|null | Publish time (Unix) |
| `body` | string\|null | HTML body |
| `enclosureMime` | string\|null | Enclosure MIME |
| `enclosureLink` | string\|null | Enclosure URL |
| `mediaThumbnail` | string\|null | Media thumbnail |
| `mediaDescription` | string\|null | Media description |
| `feedId` | integer | Parent feed id |
| `unread` | boolean | Unread flag |
| `starred` | boolean | Starred flag |
| `filtered` | boolean | Filtered by feed filter |
| `rtl` | boolean | Right-to-left content |
| `lastModified` | integer\|string\|null | Last modified |
| `fingerprint` | string\|null | Content fingerprint for dedupe |

## Changelog / Related APIs

- **v1-2:** Legacy HTTP methods (PUT where v1-3 uses POST/DELETE). See [api-v1-2.md](api-v1-2.md).
- **v2:** Newer PATCH-based folder operations (not used by this node; roadmap S-14).
- Adjacent: feed filter CRUD (`/feeds/{id}/filter`), updater admin routes, version/status — documented upstream; not wired in this node yet.
