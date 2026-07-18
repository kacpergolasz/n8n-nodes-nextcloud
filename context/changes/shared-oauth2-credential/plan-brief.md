# Shared Nextcloud OAuth2 Credential (Proven on Calendar) — Plan Brief

> Full plan: `context/changes/shared-oauth2-credential/plan.md`
> Frame brief: `context/changes/zahidcoder-adopt-or-rewrite/frame.md` (per-app nodes share a credential)

## What & Why

Deliver roadmap S-02 / FR-002: a shared Nextcloud **OAuth2** credential at the same must-have priority as Basic Auth, proven end-to-end on the existing Calendar node. This gives the suite a second shared-credential path so no author is locked to Basic Auth, and every later app node (Files, Deck, Talk, News) inherits OAuth2 for free.

## Starting Point

After S-01 the package ships one credential (`nextcloudApi`, Basic Auth) and one node (Nextcloud Calendar). The Calendar node hard-codes `nextcloudApi` in three places (node `credentials`, `getCredentials`, `nextcloudRequest`) and its secret scrubber only knows Basic Auth material. Nextcloud OAuth2 (verified) uses `{base}/apps/oauth2/authorize` + `{base}/apps/oauth2/api/v1/token`, issues a Bearer token, supports refresh, and has **no scoped access** (full-account tokens, confidential clients only).

## Desired End State

An author creates a **Nextcloud OAuth2 API** credential (server URL, username, client id/secret, OAuth consent), picks **Authentication → OAuth2** on the Calendar node, and runs the same Create/Get/Get Many/Update/Delete + calendar pickers as Basic Auth. Basic Auth still works unchanged (default). No access/refresh token or client secret leaks into outputs or errors. Both credentials are registered; build/lint/tests pass; F-01 link path still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Auth selection | `authentication` selector + both credentials via `displayOptions` on the Calendar node | n8n-idiomatic dual-auth on one node; proves the shared credential without a second node | Plan |
| OAuth2 endpoint config | Hidden `authUrl`/`accessTokenUrl` derived from `baseUrl` via `={{$self[...]}}` | Author configures one server URL, not three; matches Nextcloud's fixed paths | Plan |
| CalDAV username under OAuth2 | Require an explicit `username` field (mirror Basic Auth) | Path building needs the CalDAV user id; token `user_id` isn't reliably exposed to the node | Plan |
| Token endpoint auth | Send `client_id`/`client_secret` in body (`authentication: 'body'`) | Matches Nextcloud's token controller reading form params | Plan |
| Scope | Empty scope | Nextcloud OAuth2 has no scoped access | Plan |
| Secret scrubbing | Extend scrubber to redact access/refresh token, client secret, and `Bearer …` | Keeps PRD "no secrets in errors" guardrail for OAuth2 | Plan |
| Helper refactor | One auth-mode-aware choke point in `getCredentials`/`nextcloudRequest` | Single change covers all ops + `listSearch`; no duplicated request code | Plan |
| Proof scope | Prove on Calendar only | Matches S-02 outcome; other apps inherit the pattern later | Plan |
| Tests vs live flow | Unit-test scrubbing + credential-name resolution; OAuth flow is manual Phase 3 | No browser consent in CI; redaction proven with fixtures | Plan |
| Default auth | `basicAuth` default | Existing Calendar workflows keep working after upgrade | Plan |

## Scope

**In scope:** `nextcloudOAuth2Api` credential (`extends: ['oAuth2Api']`); Calendar authentication selector + dual credentials; auth-mode-aware helpers; OAuth2 secret scrubbing; unit tests; README OAuth2 setup; F-01 + real-NC manual OAuth2 smoke.

**Out of scope:** Other suite apps; triggers; Basic Auth behavior changes; CalDAV feature changes (S-08/S-09); live OAuth flow in CI; npm publish; username auto-discovery; dynamic client registration.

## Architecture / Approach

Add the OAuth2 credential type first, deriving Nextcloud's authorize/token URLs from `baseUrl`. Then wire Calendar: an `authentication` selector chooses between `nextcloudApi` and `nextcloudOAuth2Api` (gated by `displayOptions`); `getCredentials`/`nextcloudRequest` resolve the active credential name once and thread it through every operation and `listSearch`, so `httpRequestWithAuthentication` injects Basic or Bearer transparently. The scrubber gains OAuth2 material at the same error boundary. Manual Phase 3 completes the OAuth consent against a real Nextcloud.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. OAuth2 credential type | `nextcloudOAuth2Api` registered beside Basic Auth | `$self`-derived URLs may not interpolate in credential defaults |
| 2. Wire Calendar + scrub + tests | Auth selector, dual credentials, auth-aware helpers, OAuth2 redaction | Refactoring the hard-coded credential name without breaking Basic Auth |
| 3. OAuth2 local verification | Real-NC consent + CRUD + no-regression + no leakage | Needs a reachable Nextcloud with OAuth2 app + browser consent |

**Prerequisites:** S-01 done; a Nextcloud instance with the OAuth2 app and admin access to register a client; Node/npm for build/link.
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks & Assumptions

- **`$self` URL derivation:** if n8n does not interpolate `={{$self["baseUrl"]}}` in credential-property defaults, fall back to plain user-entered `authUrl`/`accessTokenUrl` fields pre-filled with the `/apps/oauth2/...` suffixes (confirm in Phase 3).
- **Username under OAuth2:** assumes the CalDAV path user id is entered manually and matches the OAuth-authorized account.
- **No scopes:** Nextcloud OAuth2 tokens have full account access — surfaced to users in the README, not mitigable in-node.
- **`index.php` paths:** instances without pretty URLs may need `/index.php/apps/oauth2/...`; the user's `baseUrl` should account for this if consent fails.

## Success Criteria (Summary)

- OAuth2 credential completes consent and drives Calendar CRUD + pickers with useful outputs on a real Nextcloud
- Basic Auth still works (default, no regression); one shared credential pattern now covers both auth modes
- No access/refresh token or client secret in outputs or errors; build/lint/unit tests pass; package registers both credentials + Calendar
