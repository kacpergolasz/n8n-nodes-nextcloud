# Nextcloud Deck API — OpenAPI-structured reference

> Restructured from the official API documentation ([nextcloud/deck `docs/API.md`](https://github.com/nextcloud/deck/blob/main/docs/API.md)) into an OpenAPI-like structure. No official OpenAPI/Swagger YAML is published for the Deck app; this markdown mirrors the OpenAPI layout (info, servers, security, paths, schemas).

## Info

- **Title:** Nextcloud Deck REST API
- **API version:** 1.2 (unreleased features included; v1.0 since Deck 1.0.0, v1.1 since Deck 1.3.0)
- **Description:** Kanban-style project and personal management tool for Nextcloud. Provides access for authenticated users to their boards, stacks, cards, labels, attachments, comments and sessions.
- **Source:** https://github.com/nextcloud/deck/blob/main/docs/API.md (retrieved 2026-08-16)

## Servers

| Server | Base URL | Notes |
| --- | --- | --- |
| REST API | `https://{nextcloud-host}/index.php/apps/deck/api/v1.0` | Main API |
| OCS API | `https://{nextcloud-host}/ocs/v2.php/apps/deck/api/v1.0/` | Config, Comments, Sessions (OCS envelope `ocs.meta` / `ocs.data`) |

## Security

### Authorization

- **HTTP Basic Auth** with username and app password (Nextcloud standard). All endpoints require an authenticated Nextcloud user.
- **OAuth2 Bearer token** is also accepted by Nextcloud when the server has OAuth2 configured (standard Nextcloud behavior).
- No API key / cookie-based auth is used by the Deck API itself.

### Required headers (all requests)

| Header | Value | Notes |
| --- | --- | --- |
| `OCS-APIRequest` | `true` | Mandatory for every request |
| `Content-Type` | `application/json` | Except attachment upload/update, which uses `multipart/form-data` |

### Global responses

| Status | Meaning | Example body |
| --- | --- | --- |
| `400 Bad request` | Invalid request (missing/invalid parameter, title length limit exceeded) | `{"status": 400, "message": "title must be provided"}` |
| `403 Permission denied` | User has no access to the requested entity; board creation disabled via `canCreateBoards` | `{"status": 403, "message": "Permission denied"}` |
| `304 Not Modified` | When `If-None-Match` matches the current `ETag` | — |

### Formats and headers

- **Date/Datetime:** ISO-8601, e.g. `2020-01-20T09:52:43+00:00`.
- **If-Modified-Since:** supported by index endpoints (boards, stacks, cards, attachments); IMF-fixdate `Sun, 03 Aug 2019 10:34:12 GMT` recommended.
- **ETag:** returned for board/stack/card/attachment fetch endpoints; child changes propagate to parents. Also present in JSON response objects as `"ETag"`.
- **Title length limits:** board/stack titles max 100 chars, card titles max 255 chars (violations return 400).

## Paths / Endpoints

All REST paths are relative to the REST base URL unless marked **OCS** (relative to OCS base URL). All parameters are required unless marked optional.

### Boards

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/boards` | Get a list of boards | query: `details` (Bool, optional — enhance with labels, stacks, users); header: `If-Modified-Since` (optional) | — | 200: array of [Board](#entity-board) |
| POST | `/boards` | Create a new board | — | `title` (String, max 100), `color` (String, hex e.g. `ff0000`) | 200: [Board](#entity-board) / 403: board creation disabled |
| GET | `/boards/{boardId}` | Get board details | path: `boardId` (Integer) | — | 200: [Board](#entity-board) |
| PUT | `/boards/{boardId}` | Update board details | path: `boardId` (Integer) | `title` (String, max 100), `color` (String, hex), `archived` (Bool) | 200: [Board](#entity-board) |
| DELETE | `/boards/{boardId}` | Delete a board | path: `boardId` (Integer) | — | 200 |
| POST | `/boards/{boardId}/undo_delete` | Restore a deleted board | path: `boardId` (Integer) | — | 200 |
| POST | `/boards/{boardId}/acl` | Add a new ACL rule | path: `boardId` (Integer) | `type` (Integer: `0` User, `1` Group, `7` Circle), `participant` (String, uid), `permissionEdit` (Bool), `permissionShare` (Bool), `permissionManage` (Bool) | 200: array of [AclRule](#entity-aclrule) |
| PUT | `/boards/{boardId}/acl/{aclId}` | Update an ACL rule | path: `boardId`, `aclId` (Integer) | `permissionEdit` (Bool), `permissionShare` (Bool), `permissionManage` (Bool) | 200 |
| DELETE | `/boards/{boardId}/acl/{aclId}` | Delete an ACL rule | path: `boardId`, `aclId` (Integer) | — | 200 |
| POST | `/boards/{boardId}/clone` | Clone a board | path: `boardId` (Integer) | `withCards` (Bool, default false), `withAssignments` (Bool, default false), `withLabels` (Bool, default false), `withDueDate` (Bool, default false), `moveCardsToLeftStack` (Bool, default false), `restoreArchivedCards` (Bool, default false) | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/archive` | Archive a card | path: `boardId`, `stackId`, `cardId` (Integer) | — | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/unarchive` | Unarchive a card | path: `boardId`, `stackId`, `cardId` (Integer) | — | 200 |
| GET | `/boards/import/getSystems` | List import systems | query: `system` (Integer, e.g. `trello`) | — | 200: JSON schema of the system |
| GET | `/boards/import/config/system/{schema}` | Get import config for a system | path: `schema` | — | 200: array of system names, e.g. `["trello"]` |
| POST | `/boards/import` | Import a board | — | `system` (String), `config` (Object, JSON), `data` (Object, JSON) | 200 |

### Stacks

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/boards/{boardId}/stacks` | Get stacks of a board | path: `boardId` (Integer); header: `If-Modified-Since` (optional) | — | 200: array of [Stack](#entity-stack) |
| GET | `/boards/{boardId}/stacks/archived` | Get archived stacks | path: `boardId` (Integer) | — | 200: array of [Stack](#entity-stack) |
| GET | `/boards/{boardId}/stacks/{stackId}` | Get stack details | path: `boardId`, `stackId` (Integer) | — | 200: [Stack](#entity-stack) |
| POST | `/boards/{boardId}/stacks` | Create a new stack | path: `boardId` (Integer) | `title` (String, max 100), `order` (Integer) | 200: [Stack](#entity-stack) |
| PUT | `/boards/{boardId}/stacks/{stackId}` | Update stack details | path: `boardId`, `stackId` (Integer) | `title` (String, max 100), `order` (Integer) | 200: [Stack](#entity-stack) |
| DELETE | `/boards/{boardId}/stacks/{stackId}` | Delete a stack | path: `boardId`, `stackId` (Integer) | — | 200 |

### Cards

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}` | Get card details | path: `boardId`, `stackId`, `cardId` (Integer) | — | 200: [Card](#entity-card) |
| POST | `/boards/{boardId}/stacks/{stackId}/cards` | Create a new card | path: `boardId`, `stackId` (Integer) | `title` (String, max 255), `type` (String, use `plain`), `order` (Integer), `description` (String, optional, markdown), `duedate` (timestamp, optional, ISO-8601 or null) | 200: [Card](#entity-card) |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}` | Update card details | path: `boardId`, `stackId`, `cardId` (Integer) | `title` (String, max 255), `description` (String, markdown), `type` (String, `plain`), `owner` (String), `order` (Integer), `duedate` (timestamp ISO-8601 or null), `archived` (Bool), `done` (timestamp or null) | 200: [Card](#entity-card) |
| DELETE | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}` | Delete a card | path: `boardId`, `stackId`, `cardId` (Integer) | — | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/assignLabel` | Assign a label to a card | path: `boardId`, `stackId`, `cardId` (Integer) | `labelId` (Integer) | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/removeLabel` | Remove a label from a card | path: `boardId`, `stackId`, `cardId` (Integer) | `labelId` (Integer) | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/assignUser` | Assign a user to a card | path: `boardId`, `stackId`, `cardId` (Integer) | `userId` (String) | 200: [CardAssignment](#entity-cardassignment) / 400: user already assigned or not part of board |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/unassignUser` | Unassign a user from a card | path: `boardId`, `stackId`, `cardId` (Integer) | `userId` (String) | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/reorder` | Change sorting order / move card | path: `boardId`, `stackId`, `cardId` (Integer) | `order` (Integer, target position), `stackId` (Integer, target stack) | 200 |

### Labels

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/boards/{boardId}/labels/{labelId}` | Get label details | path: `boardId`, `labelId` (Integer) | — | 200: [Label](#entity-label) |
| POST | `/boards/{boardId}/labels` | Create a new label | path: `boardId` (Integer) | `title` (String), `color` (String, hex) | 200: [Label](#entity-label) |
| PUT | `/boards/{boardId}/labels/{labelId}` | Update label details | path: `boardId`, `labelId` (Integer) | `title` (String), `color` (String, hex) | 200: [Label](#entity-label) |
| DELETE | `/boards/{boardId}/labels/{labelId}` | Delete a label | path: `boardId`, `labelId` (Integer) | — | 200 |

### Attachments

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments` | Get list of attachments | path: `boardId`, `stackId`, `cardId` (Integer); header: `If-Modified-Since` (optional) | — | 200: array of [Attachment](#entity-attachment) |
| GET | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments/{attachmentId}` | Get the attachment file | path: `boardId`, `stackId`, `cardId`, `attachmentId` (Integer) | — | 200: file |
| POST | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments` | Upload an attachment | path: `boardId`, `stackId`, `cardId` (Integer) | `multipart/form-data`: `type` (String, `file` or `deck_file`), `file` (Binary + `filename`) | 200: [Attachment](#entity-attachment) |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments/{attachmentId}` | Update an attachment | path: `boardId`, `stackId`, `cardId`, `attachmentId` (Integer) | `multipart/form-data`: `type` (String, `deck_file` only), `file` (Binary + `filename`) | 200 |
| DELETE | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments/{attachmentId}` | Delete an attachment | path: `boardId`, `stackId`, `cardId`, `attachmentId` (Integer) | — | 200 |
| PUT | `/boards/{boardId}/stacks/{stackId}/cards/{cardId}/attachments/{attachmentId}/restore` | Restore a deleted attachment | path: `boardId`, `stackId`, `cardId`, `attachmentId` (Integer) | — | 200 |

**Attachment types:** `deck_file` — stored within Deck (API ≤1.0 default, and the only type supported by attachment update); `file` — stored in the user's regular Nextcloud files (introduced in API 1.1, Deck 1.3.0).

### Config (**OCS**)

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1.0/config` | Fetch app configuration values | — | — | 200: OCS envelope with [Config](#entity-config) data |
| POST | `/api/v1.0/config/{id}/{key}` | Set a config value | path: `id` (Integer, board id), `key` (String, prefix `board:{boardId}:` for board settings) | `value` (String) | 200: OCS envelope |

Config keys: `calendar` (Bool), `cardDetailsInModal` (Bool), `cardIdBadge` (Bool), `groupLimit` (admin only, array of group objects), `notify-due` (`off`, `assigned`, `all`).

### Comments (**OCS**)

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| GET | `/cards/{cardId}/comments` | List comments | path: `cardId` (Integer); query: `limit` (Integer, default 20), `offset` (Integer, default 0) | — | 200: OCS envelope with array of [Comment](#entity-comment) |
| POST | `/cards/{cardId}/comments` | Create a new comment | path: `cardId` (Integer) | `message` (String, max 1000), `parentId` (Integer, optional, default null) | 200: OCS envelope with [Comment](#entity-comment) / 400 invalid input / 404 card or parent comment not found |
| PUT | `/cards/{cardId}/comments/{commentId}` | Update a comment (author only) | path: `cardId`, `commentId` (Integer) | `message` (String, max 1000) | 200: OCS envelope with [Comment](#entity-comment) / 400 / 404 |
| DELETE | `/cards/{cardId}/comments/{commentId}` | Delete a comment (author only) | path: `cardId`, `commentId` (Integer) | — | 200: OCS envelope with empty `data` / 400 / 404 |

Mentions are parsed server-side (`@user`) and returned in the `mentions` array. Reply comments include the parent as `replyTo` (only the immediate parent, no nested chain).

### Sessions (**OCS**)

| Method | Path | Summary | Parameters | Request body | Success response |
| --- | --- | --- | --- | --- | --- |
| PUT | `/session/create` | Create a new session | — | `boardId` (Integer) | 200: OCS envelope with `{"token": "<session-token>"}` |
| POST | `/session/sync` | Keep the session open | — | `boardId` (Integer), `token` (String) | 200: OCS envelope, empty `data` / 404 invalid or expired token |
| POST | `/session/close` | Close the session | — | `boardId` (Integer), `token` (String) | 200: OCS envelope, empty `data` |

## Components / Entities

Entity JSON shapes as returned by the API (GET responses). Fields not listed do not appear in responses. `ETag` may be present on fetchable entities.

### Entity: User / Participant

```json
{
  "primaryKey": "admin",
  "uid": "admin",
  "displayname": "Administrator"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `primaryKey` | String | Primary key of the user/group/circle |
| `uid` | String | Unique id |
| `displayname` | String | Display name |

### Entity: Board

```json
{
  "title": "Board title",
  "owner": { "primaryKey": "admin", "uid": "admin", "displayname": "Administrator" },
  "color": "ff0000",
  "archived": false,
  "labels": [],
  "acl": [],
  "permissions": {
    "PERMISSION_READ": true,
    "PERMISSION_EDIT": true,
    "PERMISSION_MANAGE": true,
    "PERMISSION_SHARE": true
  },
  "users": [],
  "shared": 0,
  "deletedAt": 0,
  "id": 10,
  "lastModified": 1586269585,
  "settings": { "notify-due": "off", "calendar": true }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Board id |
| `title` | String | Board title |
| `owner` | User | Owner user object |
| `color` | String | Hex color (e.g. `ff0000`) |
| `archived` | Bool | Whether the board is archived |
| `labels` | Array\<[Label](#entity-label)\> | Labels defined on the board (present when details requested / on create) |
| `acl` | Array\<[AclRule](#entity-aclrule)\> | Access control rules |
| `permissions` | Object | `PERMISSION_READ`, `PERMISSION_EDIT`, `PERMISSION_MANAGE`, `PERMISSION_SHARE` (Bool) |
| `users` | Array\<[User](#entity-user--participant)\> | Users with access |
| `shared` | Integer | Shared flag/count |
| `deletedAt` | Integer | Unix timestamp, `0` if not deleted |
| `lastModified` | Integer | Unix timestamp |
| `settings` | Object | Board settings, e.g. `notify-due` (`off`/`assigned`/`all`), `calendar` (Bool) |

### Entity: Stack

```json
{
  "title": "ToDo",
  "boardId": 2,
  "deletedAt": 0,
  "lastModified": 1541426139,
  "cards": [],
  "order": 999,
  "id": 4
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Stack id |
| `title` | String | Stack title |
| `boardId` | Integer | Parent board id |
| `cards` | Array\<[Card](#entity-card)\> | Cards in the stack |
| `order` | Integer | Sort order |
| `deletedAt` | Integer | Unix timestamp, `0` if not deleted |
| `lastModified` | Integer | Unix timestamp |

### Entity: Card

```json
{
  "title": "Test",
  "description": null,
  "stackId": 6,
  "type": "plain",
  "lastModified": 1541528026,
  "createdAt": 1541528026,
  "labels": null,
  "assignedUsers": null,
  "attachments": null,
  "attachmentCount": null,
  "owner": "admin",
  "order": 999,
  "archived": false,
  "done": null,
  "duedate": "2019-12-24T19:29:30+00:00",
  "deletedAt": 0,
  "commentsUnread": 0,
  "id": 10,
  "overdue": 0
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Card id |
| `title` | String | Card title |
| `description` | String/null | Markdown description |
| `stackId` | Integer | Parent stack id |
| `type` | String | Card type, `plain` |
| `owner` | String | Uid of the owning user |
| `order` | Integer | Sort order |
| `archived` | Bool | Archived state |
| `done` | Timestamp/null | ISO-8601 date when marked done, null = undone |
| `duedate` | Timestamp/null | ISO-8601 due date |
| `labels` | Array/null | Assigned labels |
| `assignedUsers` | Array/null | Assigned users |
| `attachments` | Array/null | Attachments |
| `attachmentCount` | Integer/null | Number of attachments |
| `commentsUnread` | Integer | Unread comments count |
| `overdue` | Integer | Overdue flag |
| `createdAt` | Integer | Unix timestamp |
| `lastModified` | Integer | Unix timestamp |
| `deletedAt` | Integer | Unix timestamp, `0` if not deleted |

### Entity: Label

```json
{
  "title": "Finished",
  "color": "31CC7C",
  "boardId": "2",
  "cardId": null,
  "id": 5
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Label id |
| `title` | String | Label title |
| `color` | String | Hex color |
| `boardId` | Integer | Parent board id |
| `cardId` | Integer/null | Assigned card id, null when board-level |

### Entity: Attachment

```json
{
  "cardId": 5,
  "type": "deck_file",
  "data": "6DADC2C69F4.eml",
  "lastModified": 1541529048,
  "createdAt": 1541529048,
  "createdBy": "admin",
  "deletedAt": 0,
  "extendedData": {
    "filesize": 922258,
    "mimetype": "application/octet-stream",
    "info": {
      "dirname": ".",
      "basename": "6DADC2C69F4.eml",
      "extension": "eml",
      "filename": "6DADC2C69F4"
    }
  },
  "id": 6
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Attachment id |
| `cardId` | Integer | Parent card id |
| `type` | String | `deck_file` or `file` |
| `data` | String | File name |
| `createdBy` | String | Uid of the creator |
| `createdAt` / `lastModified` | Integer | Unix timestamps |
| `deletedAt` | Integer | Unix timestamp, `0` if not deleted |
| `extendedData` | Object | `filesize`, `mimetype`, `info` (dirname/basename/extension/filename) |

### Entity: AclRule

```json
{
  "participant": { "primaryKey": "userid", "uid": "userid", "displayname": "User Name" },
  "type": 0,
  "boardId": 1,
  "permissionEdit": true,
  "permissionShare": false,
  "permissionManage": true,
  "owner": false,
  "id": 1
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Rule id |
| `participant` | User | Participant object (type depends on `type`) |
| `type` | Integer | `0` User, `1` Group, `7` Circle |
| `boardId` | Integer | Parent board id |
| `permissionEdit` / `permissionShare` / `permissionManage` | Bool | Permissions |
| `owner` | Bool | Whether participant is the board owner |

### Entity: CardAssignment

```json
{
  "id": 3,
  "participant": { "primaryKey": "admin", "uid": "admin", "displayname": "admin" },
  "cardId": 1
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Assignment id |
| `participant` | User | Assigned user |
| `cardId` | Integer | Parent card id |

### Entity: Comment (**OCS**)

```json
{
  "id": 175,
  "objectId": 12,
  "message": "This is a comment with a mention to @alice",
  "actorId": "admin",
  "actorType": "users",
  "actorDisplayName": "Administrator",
  "creationDateTime": "2020-03-10T10:23:07+00:00",
  "mentions": [
    { "mentionId": "alice", "mentionType": "user", "mentionDisplayName": "alice" }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | Integer | Comment id |
| `objectId` | Integer | Card id the comment belongs to |
| `message` | String | Comment text (markdown; mentions `@user` parsed server-side) |
| `actorId` / `actorType` / `actorDisplayName` | String | Author (`actorType` is `users`) |
| `creationDateTime` | String | ISO-8601 datetime |
| `mentions` | Array | `mentionId`, `mentionType`, `mentionDisplayName` |
| `replyTo` | Comment | Present when the comment is a reply (immediate parent only) |

### Entity: Session (**OCS**)

```json
{
  "token": "+zcJHf4rC6dobVSbuNa3delkCSfTW8OvYWTyLFvSpIv80FjtgLIj0ARlxspsazNQ"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `token` | String | Session token; used with `sync`/`close`, invalid/expired tokens return 404 |

### Entity: Config (**OCS**)

```json
{
  "calendar": true,
  "cardDetailsInModal": true,
  "cardIdBadge": true,
  "groupLimit": [{ "id": "admin", "displayname": "admin" }]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `calendar` | Bool | CalDAV calendar/tasks integration enabled |
| `cardDetailsInModal` | Bool | Bigger card view used |
| `cardIdBadge` | Bool | ID badges displayed on cards |
| `groupLimit` | Array | (Admin only) groups allowed to create boards: `{id, displayname}` |

### OCS response envelope

All **OCS** endpoints wrap payloads:

```json
{
  "ocs": {
    "meta": { "status": "ok", "statuscode": 200, "message": "OK" },
    "data": {}
  }
}
```

## Changelog (API versions)

- **v1.0** — Deck ≥1.0.0: card title max extended 100 → 255 chars; 400 returned when board/stack/card title length exceeded.
- **v1.1** — Deck 1.3.0: attachments stored in regular Nextcloud files; `file` attachment type introduced (previously only `deck_file`).
- **v1.2** (unreleased) — board import endpoints (`/boards/import/*`).

## Related APIs

- **Nextcloud Capabilities API** — Deck exposes `version` and `canCreateBoards` under `ocs.data.capabilities.deck` (see `API-Nextcloud.md`).
- **Sharees API** — `/index.php/apps/files_sharing/api/v1/sharees` for possible board sharees (users/groups/circles).
- **Comments** are stored via the Nextcloud Comments API (WebDAV endpoint can fetch/update/delete them).
- **Activity API** — the `activity` app provides activity events filtered by `deck` (see `API-Nextcloud.md`).
- **ER diagram** — entity relations: see `er-diagram.jpg` in this directory.