# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.x.x] — Unreleased

### Added

- Calendar event **Update Fields** collection (summary, description, start, end, location, all-day, timezone) with GET → ICS AST patch → PUT; preserves non-edited structure (RRULE, ATTENDEE, VALARM, X-*, UID) and bumps SEQUENCE / refreshes DTSTAMP on meaningful changes.
- Calendar-owned bidirectional ICS translator (`nodes/NextcloudCalendar/ics/`) used by Create and Update.
- Optional **Location** on Calendar event Create; empty DESCRIPTION/LOCATION omitted from create payloads.
- `webUrl` on Calendar event Create / Get / Get Many / Update — Nextcloud Calendar UI deep link for the CalDAV object (path segments encoded like CalDAV URLs).
- Deck card Update whitelist builder (`buildCardUpdatePayload`) so PUTs no longer round-trip nested/read-only GET fields.
- Suite Update Convention (`context/foundation/update-convention.md`) for whitelist-merge, sparse PUT, and CalDAV AST-patch Update patterns.
- Live verification layout under `test/n8n-cli/` (hybrid `@n8n/cli` + Webhook/`curl`), including Deck, Calendar, and Files workflow artifacts and a faker-based rich Calendar fixture generator.

### Changed

- Calendar event Update no longer requires summary/start/end at the top level; identity is calendar + event ID only.
- Calendar Update Fields: empty Timezone is omitted (keeps current TZID); UTC `Z` dateTimes convert to wall time in the preserved TZID before writing floating DATE-TIME.
- Deck card Update uses the writable-scalar whitelist instead of `mergeDefined(fullGet, patch)`.
- Files share Update uses a Google-style **Update Fields** collection (permissions, password, expireDate, publicUpload); sparse PUT via `buildShareUpdateBody` is unchanged.
- Files execute errors keep specific OCS Share API 404 messages (e.g. past expireDate) instead of always rewriting them to "Resource not found".
- Files OCS requests use `ignoreHttpStatusErrors` so Nextcloud's `ocs.meta.message` (including localized past-expireDate text) is surfaced instead of n8n's generic 404 NodeApiError.
- Files share password policy validation fails closed on transport / 5xx when the endpoint is reachable; still fails open if the `password_policy` app appears missing (404/405/501).

### Fixed

- Calendar Update refuses turning off All Day without Start and End (avoids invalid bare `YYYYMMDD` DATE-TIME).
- Calendar Update on `DURATION`-only events: clear error for date/timezone/all-day patches; setting End writes `DTEND` and removes `DURATION`.
- Calendar same-day timed → all-day bumps exclusive `DTEND` by one day (RFC 5545).
- Calendar Create/Update ISO dateTimes with offsets or non-ms fractional seconds normalize to valid ICS DATE-TIME.
- Calendar ICS patch collapses duplicate properties on set (no stale earlier SUMMARY/etc.).
