# Changelog

## 0.3.1 (2026-07-29)

### Bug Fixes

- **Nextcloud Calendar** — Get Many After/Before filters now accept n8n Luxon `DateTime` values (e.g. `{{ $now.plus({ week: 2 }) }}` / `[DateTime: …]`), query CalDAV with `REPORT` `time-range`, and decode entity-encoded `calendar-data`

## 0.3.0 (2026-07-28)

### Features

- **Nextcloud Calendar** — CalDAV event Create / Get / Get Many / Update / Delete with calendar pickers
- **Nextcloud Files** — WebDAV file/folder operations and OCS share management
- **Nextcloud Files Trigger** — Polling trigger for file/folder created or updated (Depth 1)
- **Nextcloud Deck** — Board, stack, and card operations
- **Nextcloud News** — Feed, folder, and item operations (News API v1.3)
- **Nextcloud News Trigger** — Polling trigger for new articles
- **Nextcloud API** credential — Shared Basic Auth (`baseUrl` / `username` / `appPassword`)
- **Nextcloud OAuth2 API** credential — Shared OAuth2 for suite nodes
