# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.x.x] — Unreleased

### Added

- Calendar event **Update Fields** collection (summary, description, start, end, location, all-day, timezone) with GET → ICS AST patch → PUT; preserves non-edited structure (RRULE, ATTENDEE, VALARM, X-*, UID) and bumps SEQUENCE / refreshes DTSTAMP on meaningful changes.
- Calendar-owned bidirectional ICS translator (`nodes/NextcloudCalendar/ics/`) used by Create and Update.
- Optional **Location** on Calendar event Create; empty DESCRIPTION/LOCATION omitted from create payloads.
- `webUrl` on Calendar event Create / Get / Get Many / Update — Nextcloud Calendar UI deep link for the CalDAV object.
- Deck card Update whitelist builder (`buildCardUpdatePayload`) so PUTs no longer round-trip nested/read-only GET fields.
- Live verification layout under `test/n8n-cli/` (hybrid `@n8n/cli` + Webhook/`curl`), including Deck, Calendar, and Files workflow artifacts and a faker-based rich Calendar fixture generator.

### Changed

- Calendar event Update no longer requires summary/start/end at the top level; identity is calendar + event ID only.
- Deck card Update uses the writable-scalar whitelist instead of `mergeDefined(fullGet, patch)`.
- Files share Update uses a Google-style **Update Fields** collection (permissions, password, expireDate, publicUpload); sparse PUT via `buildShareUpdateBody` is unchanged.
- Files execute errors keep specific OCS Share API 404 messages (e.g. past expireDate) instead of always rewriting them to "Resource not found".
- Files OCS requests use `ignoreHttpStatusErrors` so Nextcloud's `ocs.meta.message` (including localized past-expireDate text) is surfaced instead of n8n's generic 404 NodeApiError.
