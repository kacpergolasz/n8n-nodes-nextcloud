# Calendar — n8n-cli live tests

Hybrid tradition: [../README.md](../README.md). Workflow names: `Calendar/<test-name>`.

## Preconditions

1. Local n8n with `n8n-nodes-nextcloud` linked; Nextcloud API credential on the instance (JSON uses `Nextcloud account` / id `CwOIprgOYYtl3Kt9` — change if yours differs).
2. A writable calendar exists. Default artifacts use calendar id `personal` — change nodes if your slug differs.
3. Rebuild after Calendar code changes: `npm run build` (and ensure `~/.n8n/custom` still links this package).

## Rich fixture generator (Phase 4)

Partial-update workflows need a **structurally rich** event (RRULE, VALARM, X-*, ATTENDEE) — not a bare node Create.

```bash
# from package root
node test/n8n-cli/calendar/generate-rich-event.mjs
```

Uses `@faker-js/faker` (devDependency) to fill summary/description/location/times while keeping fixed rich structure. Writes `fixtures/n8n-cli-rich-partial-update.ics` (`eventId` = `n8n-cli-rich-partial-update`).

### Seed via CalDAV PUT

```bash
cd test/n8n-cli/calendar
node generate-rich-event.mjs

curl -sS -u "$NC_USER:$NC_APP_PASSWORD" -X PUT \
  -H "Content-Type: text/calendar; charset=utf-8" \
  --data-binary @fixtures/n8n-cli-rich-partial-update.ics \
  "$NC_BASE_URL/remote.php/dav/calendars/$NC_USER/personal/n8n-cli-rich-partial-update.ics"
```

Re-seed before each partial-update run if a previous Update changed SEQUENCE/summary/times.

**Known limitation:** changing Timezone in Update Fields may leave an orphan `VTIMEZONE` component when the TZID no longer matches — acceptable for this slice.

---

## `01-create-get-fidelity.json` → `Calendar/create-get-fidelity`

Webhook → create event (summary + times + **location**, empty description) → get event.

Assert on Get:

- `summary` matches create
- `location` is `Live test room`
- `description` is **absent** (serializer must not emit an empty DESCRIPTION)
- `date_start` / `date_end` present

```bash
n8n-cli workflow create --file=01-create-get-fidelity.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/calendar-create-get-fidelity"
n8n-cli execution list --limit=3 --format=json
n8n-cli execution get <execution-id> --includeData --format=json
```

To refresh an existing workflow: `n8n-cli workflow update <id> --file=01-create-get-fidelity.json --format=json`.

## Spot-check (manual)

Open the created event in the Nextcloud Calendar UI and confirm title, time, and location look correct (no blank description clutter required).

---

## `02-partial-update-preserves-rich-ics.json` → `Calendar/partial-update-preserves-rich-ics`

**Requires seeded rich fixture** (`eventId` `n8n-cli-rich-partial-update`).

Webhook → get → update **summary only** → get.

Assert on final Get:

- `summary` is `n8n-cli partial update — summary only`
- `recurrence_rule` still present (`FREQ=WEEKLY…`)
- `attendees` still present
- `sequence` increased vs before (spot-check ICS for VALARM / `X-N8N-LIVE-FIXTURE` if needed)

```bash
n8n-cli workflow create --file=02-partial-update-preserves-rich-ics.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/calendar-partial-update-preserves-rich-ics"
n8n-cli execution get <execution-id> --includeData --format=json
```

## `03-sequence-and-times.json` → `Calendar/sequence-and-times`

**Requires seeded rich fixture** (re-seed after running 02 if you want a clean SEQUENCE baseline).

Webhook → get → update **start/end** → get.

Assert:

- `date_start` / `date_end` reflect the new times
- `sequence` is greater than the before-Get value
- `dtstamp` refreshed
- TZID / rich props still intact when not overwritten (Get projects `start_tzid` when present)

```bash
n8n-cli workflow create --file=03-sequence-and-times.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/calendar-sequence-and-times"
n8n-cli execution get <execution-id> --includeData --format=json
```
