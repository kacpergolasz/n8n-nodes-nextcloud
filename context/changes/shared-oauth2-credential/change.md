---
change_id: shared-oauth2-credential
title: Shared Nextcloud OAuth2 credential (proven on Calendar)
status: implementing
created: 2026-07-18
updated: 2026-07-18
---

## Notes

Roadmap S-02 / FR-002. Add a shared Nextcloud OAuth2 credential (`nextcloudOAuth2Api`, `extends: ['oAuth2Api']`) at the same must-have priority as Basic Auth, and prove it end-to-end on the existing Nextcloud Calendar node so the suite has a second shared-credential path. Follows S-01 patterns: one credential reusable across the suite, proven on Calendar, no secrets in outputs or errors. Calendar gains an `authentication` selector (Basic Auth / OAuth2) with both credentials wired via `displayOptions`; shared request/getCredentials helpers become auth-mode aware; secret scrubber extends to redact bearer/access tokens and client secret. Nextcloud OAuth2 endpoints derive from `baseUrl` (`/apps/oauth2/authorize`, `/apps/oauth2/api/v1/token`); Nextcloud has no scoped access. Prerequisite S-01 is done.
