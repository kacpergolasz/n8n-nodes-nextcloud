# Nextcloud Files API — OpenAPI-structured reference

> Restructured from the official Nextcloud developer manuals ([WebDAV basic](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/WebDAV/basic.html), [OCS Share API](https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-share-api.html)) into an OpenAPI-like structure. No official OpenAPI/Swagger YAML is published; this markdown mirrors the OpenAPI layout and covers only endpoints used by this n8n node.

## Info

- **Title:** Nextcloud Files (WebDAV + OCS Sharing)
- **API version:** WebDAV (RFC 4918 + Nextcloud extensions); OCS files_sharing API v1 via OCS v2.php
- **Description:** Authenticated file/folder CRUD over WebDAV and share CRUD over the OCS Share API.
- **Sources (retrieved 2026-08-22):**
  - https://github.com/nextcloud/documentation/blob/master/developer_manual/client_apis/WebDAV/basic.rst
  - https://github.com/nextcloud/documentation/blob/master/developer_manual/client_apis/OCS/ocs-share-api.rst

## Servers

| Server | Base URL | Notes |
| --- | --- | --- |
| WebDAV files | `https://{nextcloud-host}/remote.php/dav/files/{username}` | Path segments encoded individually; root has no trailing slash |
| OCS files_sharing v1 | `https://{nextcloud-host}/ocs/v2.php/apps/files_sharing/api/v1` | All share CRUD; require `OCS-APIRequest: true` |
| OCS password_policy (optional) | `https://{nextcloud-host}/ocs/v2.php/apps/password_policy/api/v1` | Public-link password validation only |

## Security

### Authorization

- **HTTP Basic Auth** with username and app password (Nextcloud standard), or **OAuth2 Bearer** when configured.
- Auth is injected by n8n `httpRequestWithAuthentication('nextcloudApi')` — clients must not set `Authorization` manually.

### Required headers

| Context | Header | Value |
| --- | --- | --- |
| OCS | `OCS-APIRequest` | `true` |
| OCS | `Accept` | `application/json` |
| OCS POST/PUT | `Content-Type` | `application/x-www-form-urlencoded` (this node) |
| WebDAV PROPFIND | `Depth` | `1` (directory listing) |
| WebDAV PROPFIND | `Content-Type` | `application/xml; charset=utf-8` |
| WebDAV MOVE/COPY | `Destination` | Absolute WebDAV URL of the target |
| WebDAV MOVE/COPY | `Overwrite` | `T` or `F` |
| WebDAV upload | `Content-Type` | MIME type of the file |
| WebDAV download | (encoding) | `arraybuffer` / non-JSON |

### Global responses

| Status | Meaning |
| --- | --- |
| `2xx` / empty body | WebDAV success for MKCOL, DELETE, MOVE, COPY, PUT |
| `207` | PROPFIND multistatus XML |
| OCS `meta.statuscode` `100` or `200` | OCS success (HTTP may still be 4xx on OCS/v2 — see notes) |
| OCS other statuscodes | Business failure; prefer `ocs.meta.message` |

## Implementation notes (this node)

1. **Two servers, one client.** `FilesClient` is keyed to the Nextcloud host; WebDAV calls pass **absolute** URLs from `buildFilesUrl`; OCS calls pass paths under `/ocs/v2.php/...`.
2. **OCS HTTP status.** OCS/v2 maps business failures onto HTTP 4xx with a JSON envelope. Requests use `ignoreHttpStatusErrors: true` so repositories can surface `ocs.meta.message`.
3. **Share POST/PUT bodies** are `application/x-www-form-urlencoded`, not JSON.
4. **PROPFIND listing** uses Depth `1` and skips the self-response for the listed directory when building `DirectoryEntry[]`.
5. **Binary upload/download** uses Buffer bodies and `encoding: 'arraybuffer'` for GET.
6. **Password policy** fail-opens on HTTP 404/405/501 (app missing); fail-closes on transport/5xx.

## Paths / Endpoints

### WebDAV — Files & folders

Paths are absolute URLs under `/remote.php/dav/files/{username}/…`.

| Method | Path | Summary | Parameters / headers | Request body | Success |
| --- | --- | --- | --- | --- | --- |
| PROPFIND | `{filesRoot}/{path}` | List directory children | header `Depth: 1` | XML propfind (etag, contenttype, contentlength, lastmodified, resourcetype) | 207 multistatus XML |
| GET | `{filesRoot}/{path}` | Download file bytes | — | — | 200 binary |
| PUT | `{filesRoot}/{path}` | Upload / overwrite file | header `Content-Type` | raw bytes | 201/204 |
| MKCOL | `{filesRoot}/{path}` | Create folder | — | — | 201 |
| DELETE | `{filesRoot}/{path}` | Delete file or folder (recursive) | — | — | 204 |
| MOVE | `{filesRoot}/{path}` | Move/rename | `Destination`, `Overwrite` | — | 201/204 |
| COPY | `{filesRoot}/{path}` | Copy | `Destination`, `Overwrite` | — | 201/204 |

### OCS — Shares

Base: `/ocs/v2.php/apps/files_sharing/api/v1`. Always append `?format=json`.

| Method | Path | Summary | Parameters | Request body (form) | Success |
| --- | --- | --- | --- | --- | --- |
| GET | `/shares` | List shares | query `path` (optional) | — | `ocs.data`: share object or array |
| GET | `/shares/{shareId}` | Get share | path `shareId` | — | `ocs.data`: share or one-element array |
| POST | `/shares` | Create share | — | `path`, `shareType`, `permissions`, optional `shareWith`, `password`, `expireDate`, `publicUpload`, `note` | `ocs.data`: share |
| PUT | `/shares/{shareId}` | Update share | path `shareId` | subset of `permissions`, `password`, `expireDate`, `publicUpload` | `ocs.data`: share |
| DELETE | `/shares/{shareId}` | Delete share | path `shareId` | — | empty / success meta |

### OCS — Password policy (optional)

| Method | Path | Summary | Request body | Success |
| --- | --- | --- | --- | --- |
| POST | `/ocs/v2.php/apps/password_policy/api/v1/validate?format=json` | Validate share password | JSON `{ password, context: "sharing" }` | `ocs.data.passed` / `reason` |

## Components / Entities

### DirectoryEntry (node-normalized PROPFIND child)

Built from multistatus `response` blocks (self-entry for the listed folder is omitted).

| Field | Type | Description |
| --- | --- | --- |
| `href` | string | Raw DAV href |
| `basename` | string | Last path segment |
| `path` | string | User-relative path (`/…`) |
| `isFolder` | boolean | True when `resourcetype` contains `collection` |
| `size` | number? | From `getcontentlength` |
| `lastModified` | string? | From `getlastmodified` |
| `contentType` | string? | From `getcontenttype` |
| `etag` | string? | From `getetag` |

### ParsedShare (node-normalized OCS share)

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Share id |
| `shareType` | number | 0 user, 1 group, 3 public link, 4 email, … |
| `path` | string | Shared path (`path` or fallback `file_target`) |
| `permissions` | number | Bitmask: 1 read, 2 update, 4 create, 8 delete, 16 share |
| `shareWith` | string? | Recipient id |
| `url` | string? | Public link URL |
| `token` | string? | Public link token |
| `expiration` | string? | Expire date |
| `note` | string? | Note |
| `publicUpload` | boolean? | Public upload flag |
| `uidOwner` | string? | Owner uid |
| `displaynameOwner` | string? | Owner display name |
| `itemType` | string? | `file` / `folder` |
| `mimetype` | string? | MIME type |

### OCS envelope

```json
{
  "ocs": {
    "meta": {
      "status": "ok",
      "statuscode": 100,
      "message": null
    },
    "data": {}
  }
}
```

Success when `statuscode` is `100` or `200`.

### Share create POST arguments (from official docs)

| Field | Type | Notes |
| --- | --- | --- |
| `path` | string | Path to share |
| `shareType` | int | 0 user; 1 group; 3 public link; 4 email; … |
| `shareWith` | string | Required for user/group types |
| `permissions` | int | Default 31; public default 1 |
| `publicUpload` | string | `true` / `false` |
| `password` | string | Public link password |
| `expireDate` | string | `YYYY-MM-DD` |
| `note` | string | Recipient note |

## Changelog / Related APIs

- WebDAV public-share endpoint `/public.php/dav` (Nextcloud 29+) — **not used** by this node.
- Federated remote shares (`/remote_shares`) — **not used** by this node.
- CalDAV / CardDAV share the `/remote.php/dav` root but are separate node APIs.
