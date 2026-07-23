# Suite Partial Update — Plan Brief

> Full plan: `context/changes/suite-partial-update/plan.md`
> Research: `context/changes/suite-partial-update/research.md`

## What & Why

Suite Update ops must accept only changed fields without clobbering read-only or nested API data. Calendar today rebuilds a minimal ICS (wiping rich VEVENT data); Deck cards `mergeDefined` the full GET into PUT; Files sparse PUT is correct but its UI doesn’t match Google-style Update Fields. S-09 makes Updates partial-safe and consistent across apps.

## Starting Point

Board Update already whitelists `{ title, color, archived }`. Files share Update already builds a sparse body from selected keys. Calendar Get already fetches raw `text/calendar` but Update never merges. F2 deferred card whitelist into this slice.

## Desired End State

Authors can Update Deck cards and Calendar events by supplying only changed fields; Calendar preserves non-edited ICS structure (RRULE, ATTENDEE, VALARM, TZID, etc.) via a translator and bumps SEQUENCE when meaning changes. Files share Update uses the same Update Fields collection UX. Live checks live under `test/n8n-cli/<app>/` (n8n-cli create/inspect + Webhook/`curl` to start). A foundation convention note guides future apps.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Calendar field MVP | summary, description, start, end, location, all-day, timezone (Create gets optional location in translator phase) | Full common edit surface in one slice | Plan |
| Calendar merge | Bidirectional ICS translator (AST), not string surgery | Long-term fidelity + SEQUENCE/all-day/TZ | Plan |
| Translator ownership | Calendar-local `ics/` | Avoid suite ICS package before Tasks/Contacts | Plan |
| Calendar / Files UX | Google-style Update Fields collection | Matches n8n first-party Calendar + suite consistency | Research / Plan |
| SEQUENCE / etag | Bump SEQUENCE on meaningful whitelist changes; no If-Match | CalDAV client friendliness without concurrency UX | Plan |
| Deck Move | Out of scope — leave as-is | Move ≠ Update; one-parameter op | Plan |
| Deck card | `buildCardUpdatePayload` whitelist (board pattern) | Closes F2; stops nested PUT metadata | Research / Plan |
| Live verification | Hybrid: `@n8n/cli` CRUD/inspect + Webhook/`curl` to start | CLI has no execute; keeps tradition scriptable | Plan (review F1) |
| Calendar rich fixtures | Generative via `@faker-js/faker` + structural ICS template | Deterministic preserve-unknown live proof without static one-off events | Plan (review) |
| Future apps | Convention note + stubs only | No invented Talk/Tasks/Contacts field lists | Plan |
| Shared helper | Node-local builders + foundation convention | ICS ≠ JSON ≠ sparse OCS | Research / Plan |

## Scope

**In scope:**
- n8n-cli live verification scaffold
- Deck card whitelist Update (+ unit + live tests)
- Calendar ICS translator, Create on serializer, partial Update + Update Fields
- Files Update Fields collection (sparse builder kept)
- Suite Update convention doc

**Out of scope:**
- Deck Move payload changes
- If-Match / etag
- New ICS npm dependencies
- Talk/Tasks/Contacts implementations or fake whitelists
- News multi-field Update
- `nodes/shared/ics/` for this slice

## Architecture / Approach

```text
Update UX
  ├─ Calendar / Files: Update Fields collection
  └─ Deck card: flat optional fields (empty = keep) — unchanged this slice

Payload paths
  ├─ Sparse API (Files) ──► body = selected keys only ──► PUT
  └─ Full-object API
        ├─ Deck JSON ──► GET ──► buildCardUpdatePayload(whitelist) ──► PUT
        └─ Calendar ──► GET ICS ──► AST patch + SEQUENCE ──► serialize ──► PUT
```

Live: `test/n8n-cli/{deck,calendar,files}/` — Webhook workflows; `n8n-cli` create/activate/inspect; `curl` to start.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. n8n-cli tradition | `test/n8n-cli/` layout + hybrid README (cli + webhook/curl) | Local n8n/API key / webhook URL not configured |
| 2. Deck card whitelist | Safe card PUT + live deck workflow | Deck API rejects incomplete whitelist — tune from live |
| 3. Calendar ICS translator | Parse/serialize AST + create/get live | Preserve-unknown edge cases (folding, multi-VEVENT) |
| 4. Calendar partial Update | GET→patch→PUT + Update Fields + SEQUENCE; faker generative rich ICS | All-day/TZ / VTIMEZONE orphans; UID vs filename; seed ACL for ATTENDEE |
| 5. Files Update Fields | Collection UI + live files workflow | Saved workflow param-shape break (pre-1.0 OK) |
| 6. Suite convention | `context/foundation/update-convention.md` | None significant |

**Prerequisites:** Local n8n with community node linked; Nextcloud with Deck/Calendar/Files fixtures; S-01 + S-04 already delivered in tree.
**Estimated effort:** ~4–6 sessions across 6 phases (Phase 3–4 heaviest).

## Open Risks & Assumptions

- Deck card PUT may require additional scalars beyond the planned whitelist — adjust from n8n-cli live results.
- Changing Calendar timezone without rewriting VTIMEZONE may leave orphan zone components.
- Deck Move still `mergeDefined`s full GET (known debt, explicitly deferred).
- ICS translator is hand-rolled; multi-VEVENT / RECURRENCE-ID edge cases may need follow-ups.

## Success Criteria (Summary)

- Partial Deck/Calendar Updates do not clobber nested or non-edited rich data
- Files and Calendar Update UX both use Update Fields collections
- Each touched app has runnable hybrid n8n-cli artifacts under `test/n8n-cli/<app>/` (Webhook + curl + execution get)
- Future apps can follow `update-convention.md` without re-deriving the pattern
