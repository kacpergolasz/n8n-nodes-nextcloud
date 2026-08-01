# Calendar — n8n-cli live tests

Hybrid tradition: [../README.md](../README.md). Workflow names: `Calendar/<test-name>`.

## Preconditions

1. Local n8n with `n8n-nodes-nextcloud` linked; Nextcloud API credential on the instance (JSON uses `Nextcloud account` / id `CwOIprgOYYtl3Kt9` — change if yours differs).
2. A writable calendar exists. Default artifact uses calendar id `personal` — change the Create/Get nodes if your slug differs.
3. Rebuild after Calendar code changes: `npm run build` (and ensure `~/.n8n/custom` still links this package).

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
