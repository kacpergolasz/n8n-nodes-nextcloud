# Nextcloud Files API — Documentation

Sources for building a Nextcloud Files API client covering **WebDAV** file/folder operations and the **OCS files_sharing** API. Retrieved 2026-08-22 from the [nextcloud/documentation](https://github.com/nextcloud/documentation) repository. Nextcloud publishes no OpenAPI/Swagger YAML for these surfaces — the authoritative documentation is the RST below, restructured into an OpenAPI-style reference focused on endpoints used by this node.

## Files

| File | Purpose |
| --- | --- |
| [openapi.md](openapi.md) | **Main reference.** OpenAPI-structured: Info, Servers, Authorization, Endpoints (WebDAV + OCS shares), Entities (`DirectoryEntry`, `ParsedShare`, OCS envelope). |
| [webdav-basic.rst](webdav-basic.rst) | Verbatim official Basic File & Folder Operations (WebDAV) from nextcloud/documentation. |
| [ocs-share-api.rst](ocs-share-api.rst) | Verbatim official OCS Share API from nextcloud/documentation. |

## Quick facts

- **Auth:** HTTP Basic (username + app password) or OAuth2 Bearer, Nextcloud standard.
- **WebDAV base:** `https://{host}/remote.php/dav/files/{username}/…`
- **OCS shares base:** `https://{host}/ocs/v2.php/apps/files_sharing/api/v1`
- **OCS header:** `OCS-APIRequest: true` on all OCS calls; `format=json` query for JSON envelopes.
- **Entities:** Directory entries (PROPFIND multistatus) → files/folders; shares via OCS `ParsedShare`.
- **Password policy (optional):** `POST /ocs/v2.php/apps/password_policy/api/v1/validate` — used when setting public-link passwords; fail-open if the app is missing (404/405/501).

## Integration notes

See [openapi.md — Implementation notes](openapi.md#implementation-notes-this-node) for node-specific contracts (absolute WebDAV URLs, Destination/Overwrite headers, OCS form bodies, ignoreHttpStatusErrors).
