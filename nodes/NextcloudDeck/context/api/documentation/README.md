# Nextcloud Deck API — Documentation

Sources for building a Nextcloud Deck API client. Retrieved 2026-08-16 from the [nextcloud/deck](https://github.com/nextcloud/deck) repository. The Deck app publishes no official OpenAPI/Swagger YAML — the authoritative documentation is the Markdown below, restructured into an OpenAPI-style reference.

## Files

| File | Purpose |
| --- | --- |
| [openapi.md](openapi.md) | **Main reference.** OpenAPI-structured: Info, Servers, Authorization, Endpoints (by tag), Entities (schemas with GET payloads). |
| [API.md](API.md) | Verbatim official REST API documentation (`docs/API.md`, nextcloud/deck `main`). Source of truth for all endpoints. |
| [API-Nextcloud.md](API-Nextcloud.md) | Verbatim Nextcloud integration docs (`docs/API-Nextcloud.md`): Capabilities API, sharees, comments, activity. |
| [er-diagram.jpg](er-diagram.jpg) | Entity-relationship diagram for the Deck database (`docs/resources/er-diagram.jpg`). |

## Quick facts

- **Auth:** HTTP Basic (username + app password) or OAuth2 Bearer, Nextcloud standard.
- **Headers:** `OCS-APIRequest: true` + `Content-Type: application/json` on every request (attachments use `multipart/form-data`).
- **REST base:** `https://{host}/index.php/apps/deck/api/v1.0`
- **OCS base:** `https://{host}/ocs/v2.php/apps/deck/api/v1.0/` (Config, Comments, Sessions)
- **Entities:** Board → Stack → Card → (Label, Attachment, Comment, Assignment); Board → ACL rules.
- **Errors:** 400 invalid request, 403 permission denied / board creation disabled, 404 not found / invalid session token, 304 with `If-None-Match`/ETag caching.

## Integration notes

See [openapi.md — Implementation notes](openapi.md#implementation-notes-this-node) for three controller quirks this node relies on: full-object board PUT (`archived` defaults to `false`), reorder `stackId` taken from the URL (not the body), and card GET `owner` / extra keys. `API.md` stays a verbatim copy of upstream docs and is not edited for these.