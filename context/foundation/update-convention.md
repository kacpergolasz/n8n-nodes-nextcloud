# Suite Update Convention

How Nextcloud suite nodes implement **Update** so partial edits stay safe. Use this when adding or changing Update ops (Talk, Tasks, Contacts, or new apps).

## Choose a golden path

| API shape | Pattern | When |
| --- | --- | --- |
| Full-object PUT (JSON) | GET → **whitelist-merge** → PUT | API expects a complete writable object (e.g. Deck boards/cards) |
| Sparse PUT / PATCH | **Update Fields** → body with only selected keys | API accepts a partial body (e.g. Files OCS share Update) |
| CalDAV / CardDAV body | GET raw → **AST patch** → serialize → PUT | Content is ICS/vCard, not JSON (Calendar events today) |

Pick from the API contract, not from habit. News-style single-purpose mutation endpoints need no multi-field Update pattern.

## Full-object PUT (whitelist-merge)

1. GET the current entity.
2. Build a patch from the UI (only fields the user set).
3. Emit a PUT body via an explicit builder that copies **only writable scalars** from `current` when the patch omits them.
4. Never put nested/read-only GET fields (`labels`, `assignedUsers`, timestamps, soft-delete, etc.) into the body.

Canonical builders:

- Deck board: `buildBoardUpdatePayload` in `nodes/NextcloudDeck/GenericFunctions.ts`
- Deck card: `buildCardUpdatePayload` in the same file

Required API scalars that the UI does not edit (e.g. card `owner`) come from GET via a resolver — not from Update Fields.

## Sparse PUT + Update Fields

1. UI is a single **Update Fields** collection (`displayName: 'Update Fields'`, typically `name: 'updateFields'`).
2. Execute derives `fieldsToUpdate = Object.keys(updateFields)` and values from nested properties.
3. A builder emits only selected keys (clear-by-empty / explicit `false` when the key is present).
4. Reject an empty collection at execute/builder time.

Canonical example: Files share Update — `buildShareUpdateBody` in `nodes/NextcloudFiles/GenericFunctions.ts`, collection in `nodes/NextcloudFiles/shared/descriptions.ts`.

## CalDAV / CardDAV (Calendar ICS lessons)

Calendar owns a hand-rolled ICS translator under `nodes/NextcloudCalendar/ics/` (parse ↔ serialize, preserve-unknown). No new npm ICS dependency.

Update path:

1. GET raw ICS (`Accept: text/calendar`).
2. Parse to AST; patch only the whitelist on the target VEVENT (`summary`, `description`, `start`, `end`, `location`, all-day, timezone/TZID).
3. Keep `UID` from the ICS (filename/`eventId` may differ).
4. Refresh `DTSTAMP` on every write; bump `SEQUENCE` only when a whitelisted field actually changes after normalize.
5. Serialize and PUT. Non-whitelisted structure (RRULE, VALARM, ATTENDEE, `X-*`, VTIMEZONE, …) must survive.

Create uses the same serializer (do not force empty DESCRIPTION/LOCATION).

**Known limitation:** Changing TZID via Update Fields may leave an orphan `VTIMEZONE` component until a later slice rewrites timezone definitions.

**Tasks / Contacts:** When their API is chosen (CalDAV vs JSON OCS vs other), reuse these lessons if the body is ICS/vCard; otherwise use whitelist-merge or sparse PUT. Do **not** invent field whitelists until the API is selected.

## UX language

Prefer Google-style **Update Fields** collections for multi-field Updates (Calendar events, Files shares). Identity params stay required outside the collection. Empty Update Fields → operation error.

## Anti-patterns

- **`mergeDefined(fullGet, patch)`** (or equivalent full-object spread) for Update PUT — nested/read-only fields round-trip and can clobber server state. Deck card Update used to do this; cards now use `buildCardUpdatePayload`.
- Rebuilding a minimal ICS/JSON body and PUT without GET (Calendar’s old Update) — drops unknown properties.
- Inventing Talk / Tasks / Contacts writable-field lists before the product API for that app is chosen.

## Known debt

Deck **Move** (`moveCard`) still uses legacy `mergeDefined`. Move is not Update; fixing it is out of band for the suite Update contract. Do not copy that pattern into new Update ops.

## Live verification

Prove Update behavior against local n8n with the hybrid tradition under `test/n8n-cli/`:

- `@n8n/cli` for workflow create/update/get/activate and execution inspect
- Webhook trigger + `curl` to start (CLI has no execute)
- Per-app folders: `test/n8n-cli/{deck,calendar,files}/`

See `test/n8n-cli/README.md`.

## Pre-1.0 param-shape note

Switching required fields → Update Fields collections (or multiOptions → collection) can break saved workflows. Acceptable before 1.0; call out in CHANGELOG / PR when it happens.
