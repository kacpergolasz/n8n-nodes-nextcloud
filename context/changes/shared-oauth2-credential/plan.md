# Shared Nextcloud OAuth2 Credential (Proven on Calendar) Implementation Plan

## Overview

Implement roadmap S-02 / FR-002: a shared Nextcloud **OAuth2** credential (`nextcloudOAuth2Api`, `extends: ['oAuth2Api']`) at the same must-have priority as Basic Auth, proven end-to-end on the existing Nextcloud Calendar node. This establishes the second shared-credential path for the suite — every later app node (Files, Deck, Talk, News) will be able to reuse it exactly as it reuses `nextcloudApi`. The OAuth2 credential type comes first; wiring it into Calendar proves shared use.

## Current State Analysis

After S-01, `packages/nextcloud/` ships exactly one credential (`nextcloudApi`, Basic Auth) and one node (Nextcloud Calendar). The Calendar node hard-codes the Basic Auth credential in three places:

- `NextcloudCalendar.node.ts` declares `credentials: [{ name: 'nextcloudApi', required: true }]` and has no `authentication` selector.
- `GenericFunctions.getCredentials()` reads `context.getCredentials('nextcloudApi')` and returns `{ baseUrl, username, appPassword }` (`NextcloudCredentialData`).
- `GenericFunctions.nextcloudRequest()` calls `httpRequestWithAuthentication.call(context, 'nextcloudApi', …)` with the credential name hard-coded.

The error path in `execute()` scrubs secrets via `scrubErrorMessage(error, { appPassword, username })`; `shared/scrubSecrets.ts` redacts appPassword, `username:password`, `Authorization: Basic …`, and URL-embedded credentials — but has **no** bearer-token or client-secret handling. Unit tests cover `scrubSecrets` and `GenericFunctions` parsers.

Nextcloud OAuth2 (verified against Nextcloud admin docs + `apps/oauth2` controller):

- Authorization endpoint: `{base}/apps/oauth2/authorize` (or `/index.php/apps/oauth2/authorize` without pretty URLs).
- Token endpoint: `{base}/apps/oauth2/api/v1/token`; expects form-encoded `grant_type`, `client_id`, `client_secret`, `code` / `refresh_token`.
- Grants `authorization_code` and `refresh_token`; returns `{ access_token, token_type, expires_in, refresh_token, user_id }`.
- Access token is a **Bearer** token; CalDAV endpoints accept `Authorization: Bearer …`.
- **No scoped access** — every token has full account access; confidential clients only (client_id + client_secret required).

### Key Discoveries:

- Credential name is hard-coded in `GenericFunctions.ts:81` (`getCredentials`) and `GenericFunctions.ts:97` (`nextcloudRequest`), and in `NextcloudCalendar.node.ts:66` — all three must become auth-mode aware.
- CalDAV paths are built from `username` (`buildCalendarHomeUrl` / `resolveCalendarUrl` in `GenericFunctions.ts`). OAuth2 tokens do not carry a usable path user id into n8n's generic OAuth2 credential storage, so the OAuth2 credential must also collect `baseUrl` + `username`, mirroring Basic Auth.
- n8n's `httpRequestWithAuthentication` auto-injects the Bearer header and handles token refresh for any credential extending `oAuth2Api`; PROPFIND/PUT/DELETE work unchanged once the credential name is swapped.
- Scrubber (`shared/scrubSecrets.ts`) is the single choke point for the PRD "no secrets in errors" guardrail and today only knows Basic Auth material.
- The node exposes `usableAsTool: true` and `resourceLocator` calendar pickers; both call `getCredentials` / `nextcloudRequest`, so an auth-mode-aware helper covers `listSearch` too.

## Desired End State

A workflow author can create a **Nextcloud OAuth2 API** credential (enter server URL, username, client id/secret, complete the OAuth consent flow against their Nextcloud), attach it to the Nextcloud Calendar node by choosing **Authentication → OAuth2**, and run Create / Get / Get Many / Update / Delete with the same useful outputs as Basic Auth — including list-or-type calendar pickers. Choosing **Authentication → Basic Auth** still uses `nextcloudApi` with no behavior change (no regression). No access token, refresh token, or client secret appears in node outputs or error messages. The package registers both credentials (`nextcloudApi` + `nextcloudOAuth2Api`) and the one Calendar node; build, lint, and unit tests pass; the F-01 local link path still works.

### Key Discoveries:

- Soft phase split: ship the OAuth2 credential type first (build/lint only), then wire it into Calendar and extend scrubbing/tests, then a manual real-instance OAuth2 verification (mirrors S-01's Phase 1→2→3 shape).
- The `authentication` selector defaults to `basicAuth` so existing Calendar workflows keep working after upgrade with no change.
- OAuth2 `authUrl`/`accessTokenUrl` derive from the credential's `baseUrl` so users configure one server URL, not three.

## What We're NOT Doing

- No other suite apps (Files, Deck, Talk, News) — OAuth2 is proven only on Calendar in this slice (they inherit the pattern later).
- No triggers (polling/webhook).
- No change to Basic Auth behavior, field names, or the `nextcloudApi` credential.
- No CalDAV feature changes (Get Many paging S-08, partial update S-09 stay out of scope).
- No live OAuth2 flow in CI (no reachable Nextcloud / browser consent in CI) — Phase 3 is the manual integration proof.
- No npm publish / package rename.
- No username auto-discovery via CalDAV `current-user-principal` (username stays an explicit field, matching Basic Auth).
- No dynamic client registration — the user creates the OAuth2 app in Nextcloud admin settings manually.

## Implementation Approach

Three ordered deliverables:

1. **OAuth2 credential first** — add `nextcloudOAuth2Api` (`extends: ['oAuth2Api']`) with `baseUrl` + `username` fields and hidden OAuth2 defaults derived from `baseUrl`, register it alongside `nextcloudApi`. Credential exists and loads before any node wiring.
2. **Wire into Calendar (prove shared use)** — add an `authentication` selector to the Calendar node, declare both credentials with `displayOptions`, make `getCredentials`/`nextcloudRequest` auth-mode aware through one choke point, extend the scrubber to redact bearer/access tokens and client secret, and update unit tests + README.
3. **Manual OAuth2 verification** — register a Nextcloud OAuth2 app, complete the consent flow in n8n, run Calendar ops under OAuth2, confirm Basic Auth still works, and confirm no token leakage in errors.

Source of truth for existing behavior: `nodes/NextcloudCalendar/` and `credentials/NextcloudApi.credentials.ts`. n8n OAuth2 conventions: generic `oAuth2Api` extension used by other self-hosted community credentials.

## Critical Implementation Details

- **OAuth2 endpoint derivation:** The credential should compute `authUrl` = `={{$self["baseUrl"]}}/apps/oauth2/authorize` and `accessTokenUrl` = `={{$self["baseUrl"]}}/apps/oauth2/api/v1/token` from the user's `baseUrl`, with `grantType` = `authorizationCode`, `scope` empty (Nextcloud has no scoped access), and `authentication` = `body` (Nextcloud's token controller reads `client_id`/`client_secret` from form params). If n8n does not reliably interpolate `={{$self[...]}}` in credential-property defaults, fall back to plain user-entered `authUrl`/`accessTokenUrl` string fields pre-filled with the `/apps/oauth2/...` suffixes — this is the one assumption to confirm in Phase 3 (see Open Risks).
- **Single auth choke point:** `getCredentials` and `nextcloudRequest` must resolve the active credential name (`nextcloudApi` vs `nextcloudOAuth2Api`) from the node's `authentication` parameter and thread it through; do not duplicate request helpers per auth mode. `listSearch/getCalendars` and every `execute` operation go through these helpers, so one change covers all call sites.
- **Secret scrubbing for OAuth2:** The error boundary in `execute()` must scrub OAuth2 material when OAuth2 is active — at least the access token (from `oauthTokenData.access_token`), refresh token, and client secret — plus a generic `Bearer <token>` redaction. Redaction must never depend on a live Nextcloud; prove it with fixture tokens in unit tests.
- **CalDAV username under OAuth2:** Path building still needs `username`; read it from whichever credential is active. Keep the field description clear that it is the CalDAV path user id (as in Basic Auth), not necessarily the login email.

## Phase 1: Nextcloud OAuth2 credential type

### Overview

Add the shared `nextcloudOAuth2Api` credential and register it beside `nextcloudApi`, without touching the Calendar node or requiring a live Nextcloud.

### Changes Required:

#### 1. OAuth2 credential type + icon

**File**: `credentials/NextcloudOAuth2Api.credentials.ts` (new), `credentials/nextcloudOAuth2Api.svg` (new — may reuse the Nextcloud brand mark)

**Intent**: Provide a shared Nextcloud OAuth2 credential the whole suite can reuse, mirroring the `baseUrl` + `username` contract of Basic Auth so nodes build CalDAV paths identically regardless of auth mode.

**Contract**: `ICredentialType` with `name = 'nextcloudOAuth2Api'`, `displayName = 'Nextcloud OAuth2 API'`, `extends = ['oAuth2Api']`, `icon` co-located. Visible properties: `baseUrl` (string, required, same placeholder/guidance as Basic Auth) and `username` (string, required, CalDAV path user id guidance). Hidden oAuth2Api overrides: `grantType` = `authorizationCode`; `authUrl` default `={{$self["baseUrl"]}}/apps/oauth2/authorize`; `accessTokenUrl` default `={{$self["baseUrl"]}}/apps/oauth2/api/v1/token`; `scope` empty; `authentication` = `body`. `documentationUrl` pointing at the Nextcloud OAuth2 admin page. Do not add a declarative `test` block that assumes Basic Auth.

#### 2. Register credential

**File**: `package.json`

**Intent**: Make the OAuth2 credential loadable in n8n alongside Basic Auth.

**Contract**: Append `dist/credentials/NextcloudOAuth2Api.credentials.js` to `n8n.credentials` (keep `NextcloudApi`). Leave `n8n.nodes` unchanged.

### Success Criteria:

#### Automated Verification:

- `credentials/NextcloudOAuth2Api.credentials.ts` and its icon exist
- `package.json` `n8n.credentials` lists both `NextcloudApi` and `NextcloudOAuth2Api`
- `npm run build` succeeds
- `npm run lint` succeeds

#### Manual Verification:

- After local load, "Nextcloud OAuth2 API" appears as a selectable credential type (OAuth consent flow itself is exercised in Phase 3)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Wire Calendar for Basic OR OAuth2 + scrubbing + tests

### Overview

Give the Calendar node an authentication selector, wire both credentials, make the shared request/credential helpers auth-mode aware through one choke point, extend secret scrubbing to OAuth2 material, update unit tests, and document OAuth2 setup.

### Changes Required:

#### 1. Authentication selector + dual credentials

**File**: `nodes/NextcloudCalendar/NextcloudCalendar.node.ts`

**Intent**: Let the author choose Basic Auth or OAuth2 on the Calendar node while both use the same operations and pickers, proving the shared credential across the suite.

**Contract**: Add an `authentication` property (`type: 'options'`, `noDataExpression: true`, options `Basic Auth` → `basicAuth`, `OAuth2` → `oAuth2`, default `basicAuth`) as the first property. Change `credentials` to two entries, each gated by `displayOptions`: `{ name: 'nextcloudApi', required: true, displayOptions: { show: { authentication: ['basicAuth'] } } }` and `{ name: 'nextcloudOAuth2Api', required: true, displayOptions: { show: { authentication: ['oAuth2'] } } }`.

#### 2. Auth-mode-aware shared helpers

**File**: `nodes/NextcloudCalendar/GenericFunctions.ts`, `nodes/NextcloudCalendar/EventInterface.ts`

**Intent**: Resolve the active credential once and thread its name through both credential loading and every HTTP call, so all operations and `listSearch` work under either auth mode without duplicated code.

**Contract**: `getCredentials` reads the `authentication` node parameter (default `basicAuth`), maps it to a credential name (`basicAuth` → `nextcloudApi`, `oAuth2` → `nextcloudOAuth2Api`), fetches that credential, and returns a normalized shape carrying at least `{ baseUrl, username, credentialName }` plus the secret material available for that mode (`appPassword` for Basic; access/refresh token + client secret for OAuth2, read from `oauthTokenData` / credential fields). `nextcloudRequest` accepts (or reads from the returned shape) the resolved `credentialName` and passes it to `httpRequestWithAuthentication` instead of the literal `'nextcloudApi'`. Update `NextcloudCredentialData` (or add a companion type) accordingly. `listSearch/getCalendars.ts` continues to call these helpers unchanged.

#### 3. Extend secret scrubber to OAuth2

**File**: `nodes/NextcloudCalendar/shared/scrubSecrets.ts`, `nodes/NextcloudCalendar/NextcloudCalendar.node.ts` (catch path)

**Intent**: Close the PRD "no secrets in errors" guardrail for OAuth2, matching the Basic Auth coverage already in place.

**Contract**: Extend `ScrubSecretsInput` with optional `accessToken`, `refreshToken`, and `clientSecret`; redact each non-empty value and add a generic `Bearer <token>` redaction regex (alongside the existing `Basic …` one). The `execute` catch block passes the active mode's secrets into `scrubErrorMessage` (Basic material for `basicAuth`, token/client-secret material for `oAuth2`).

#### 4. Unit tests

**File**: `nodes/NextcloudCalendar/test/scrubSecrets.test.ts`, `nodes/NextcloudCalendar/test/GenericFunctions.test.ts` (or a new helper test)

**Intent**: Lock OAuth2 redaction and credential-name resolution without a live Nextcloud.

**Contract**: Add scrubber cases proving `accessToken`, `refreshToken`, `clientSecret`, and `Bearer <blob>` are fully redacted and clean strings pass through. Add a test for the auth-mode → credential-name mapping (mock the `authentication` param and assert `getCredentials` targets `nextcloudApi` vs `nextcloudOAuth2Api`). Keep existing Basic Auth tests green.

#### 5. README OAuth2 setup

**File**: `README.md`

**Intent**: Tell authors how to stand up the Nextcloud OAuth2 app and pick OAuth2 on the Calendar node.

**Contract**: Add a short "Nextcloud OAuth2 API" credential section: create the OAuth2 client in Nextcloud Admin → Security, paste the n8n OAuth Redirect URL, copy client id/secret into n8n, enter server URL + username, note that Nextcloud grants full-account access (no scopes) and requires a confidential client. Mention the Calendar node's Authentication selector. Do not rewrite unrelated README sections.

### Success Criteria:

#### Automated Verification:

- Calendar node exposes an `authentication` selector and declares both credentials with `displayOptions`
- `GenericFunctions` resolves credential name from the `authentication` param (no hard-coded `'nextcloudApi'` in `nextcloudRequest`)
- `npm run build` succeeds
- `npm run lint` succeeds
- `npm test` succeeds (OAuth2 scrubbing + credential-name resolution + existing suites)

#### Manual Verification:

- (Optional mid-phase) After rebuild/link the Calendar node shows Basic Auth vs OAuth2 and the correct credential picker per choice — full flow deferred to Phase 3

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: North-star OAuth2 local verification

### Overview

Prove FR-002 on a real Nextcloud via the F-01 link path: register an OAuth2 app, complete the consent flow in n8n, run Calendar operations under OAuth2, confirm Basic Auth is unaffected, and confirm no token leakage.

### Changes Required:

#### 1. Manual verification only

**File**: none required (docs updated in Phase 2)

**Intent**: Close S-02 with human-run evidence against a real instance; fix forward into this phase only if verification surfaces defects.

**Contract**: Follow the README F-01 gate (`build` → `npm link` → link `n8n-nodes-nextcloud` in `~/.n8n/custom` → `n8n start`). In Nextcloud Admin → Security create an OAuth2 client with n8n's redirect URL; create a **Nextcloud OAuth2 API** credential (server URL, username, client id/secret) and complete the OAuth consent. On Calendar, select Authentication → OAuth2 and exercise Create / Get / Get Many / Update / Delete plus the calendar picker (From List + By ID). Re-run one Basic Auth operation to confirm no regression. Force an error and confirm no access/refresh token or client secret appears in the UI error.

### Success Criteria:

#### Automated Verification:

- Re-run `npm run build`, `npm run lint`, and `npm test` after any Phase 3 fixes

#### Manual Verification:

- OAuth2 consent completes and n8n stores the token for the Nextcloud OAuth2 API credential
- Calendar Create / Get / Get Many / Update / Delete produce useful items under OAuth2 (no secrets in outputs)
- Calendar resourceLocator works in list and manual id modes under OAuth2
- Switching a node back to Basic Auth still works (no regression)
- Deliberate error path does not expose access token, refresh token, or client secret

**Implementation Note**: This phase is the human gate for S-02. Pause until manual confirmation succeeds before treating the change as implemented.

---

## Testing Strategy

### Unit Tests:

- Scrubber: fixture `accessToken`, `refreshToken`, `clientSecret`, and `Bearer <blob>` are fully redacted; existing Basic Auth cases still pass; clean strings unchanged
- Helper: `authentication` param maps to the correct credential name (`nextcloudApi` / `nextcloudOAuth2Api`)

### Integration Tests:

- None in CI (no live Nextcloud / browser consent). Manual Phase 3 is the integration proof.

### Manual Testing Steps:

1. `npm run build && npm run lint && npm test` in `packages/nextcloud`
2. F-01 link path; open the Nextcloud Calendar node
3. Create a Nextcloud OAuth2 client in Nextcloud admin; create the n8n OAuth2 credential and complete consent
4. Authentication → OAuth2: run Get Many (From List and By ID), then Create → Get → Update → Delete one event
5. Inspect items for useful fields and absence of tokens
6. Switch a node to Basic Auth and confirm it still works
7. Trigger an error (bad event id) with continue-on-fail and confirm no OAuth2 secret leaks

## Performance Considerations

OAuth2 adds no per-request cost beyond token injection; n8n caches and refreshes the token. CalDAV request shapes are unchanged from S-01. No new runtime dependencies.

## Migration Notes

- Existing Calendar workflows keep working after upgrade: the `authentication` selector defaults to `basicAuth`, so nodes that never set it continue to use `nextcloudApi`.
- No credential data migration; `nextcloudApi` is untouched.
- After Phase 2, rebuild/restart n8n so the new credential type and selector appear.

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD FR-002 (+ guardrails, Access Control): `context/foundation/prd.md`
- Frame (rewrite, not zahidcoder; per-app nodes share a credential): `context/changes/zahidcoder-adopt-or-rewrite/frame.md`
- S-01 archive (Basic Auth + Calendar patterns): `context/archive/2026-07-18-shared-basic-auth-calendar/plan.md`
- Basic Auth credential: `credentials/NextcloudApi.credentials.ts`
- Calendar wiring / helpers: `nodes/NextcloudCalendar/NextcloudCalendar.node.ts`, `nodes/NextcloudCalendar/GenericFunctions.ts`
- Secret scrubber: `nodes/NextcloudCalendar/shared/scrubSecrets.ts`
- Nextcloud OAuth2 endpoints & Bearer/no-scope notes: Nextcloud admin manual "OAuth2"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Nextcloud OAuth2 credential type

#### Automated

- [x] 1.1 OAuth2 credential type and icon exist under `credentials/` — af37a4a
- [x] 1.2 `package.json` registers both `NextcloudApi` and `NextcloudOAuth2Api` — af37a4a
- [x] 1.3 `npm run build` succeeds — af37a4a
- [x] 1.4 `npm run lint` succeeds — af37a4a

#### Manual

- [x] 1.5 "Nextcloud OAuth2 API" appears as a selectable credential type after local load

### Phase 2: Wire Calendar for Basic OR OAuth2 + scrubbing + tests

#### Automated

- [x] 2.1 Calendar node exposes `authentication` selector and both credentials with `displayOptions`
- [x] 2.2 `GenericFunctions` resolves credential name from `authentication` (no hard-coded `'nextcloudApi'` in `nextcloudRequest`)
- [x] 2.3 `npm run build` succeeds
- [x] 2.4 `npm run lint` succeeds
- [x] 2.5 `npm test` succeeds (OAuth2 scrubbing + credential-name resolution + existing suites)

#### Manual

- [ ] 2.6 Node shows Basic Auth vs OAuth2 and the correct credential picker per choice

### Phase 3: North-star OAuth2 local verification

#### Automated

- [ ] 3.1 `npm run build`, `npm run lint`, and `npm test` still pass after any Phase 3 fixes

#### Manual

- [ ] 3.2 OAuth2 consent completes and n8n stores the token
- [ ] 3.3 Calendar Create / Get / Get Many / Update / Delete produce useful items under OAuth2 without secrets
- [ ] 3.4 Calendar picker works in list and manual id modes under OAuth2
- [ ] 3.5 Switching a node back to Basic Auth still works (no regression)
- [ ] 3.6 Error path does not expose access token, refresh token, or client secret
