# Nextcloud News API — Documentation

Sources for building a Nextcloud News API client. Retrieved 2026-08-22 from the [nextcloud/news](https://github.com/nextcloud/news) repository. The News app publishes no official OpenAPI/Swagger YAML — the authoritative documentation is the Markdown below, restructured into an OpenAPI-style reference.

## Files

| File | Purpose |
| --- | --- |
| [openapi.md](openapi.md) | **Main reference.** OpenAPI-structured: Info, Servers, Authorization, Endpoints (by tag), Entities (schemas with GET payloads). Focused on endpoints used by this node. |
| [api-v1-3.md](api-v1-3.md) | Verbatim official External API v1-3 documentation (`docs/development/api/api-v1-3.md`, nextcloud/news `master`). Source of truth for all endpoints. |
| [api-v1-2.md](api-v1-2.md) | Verbatim legacy External API v1-2 documentation (reference only; this node targets v1-3). |

## Quick facts

- **Auth:** HTTP Basic (username + app password) or OAuth2 Bearer, Nextcloud standard.
- **Headers:** `Content-Type: application/json` / `Accept: application/json` for JSON routes; favicon returns raw `image/*`.
- **REST base:** `https://{host}/index.php/apps/news/api/v1-3`
- **Entities:** Folder → Feed → Item; favicon keyed by MD5 of feed URL.
- **Errors:** 404 missing entity, 409 conflict (duplicate folder/feed), 422 invalid input.

## Integration notes

See [openapi.md — Implementation notes](openapi.md#implementation-notes-this-node) for node-specific contracts (bulk item body key, favicon binary encoding, create envelopes).
