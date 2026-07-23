# Deck — n8n-cli live tests

Hybrid tradition: [../README.md](../README.md). Workflow names: `Deck/<test-name>`.

## Preconditions

1. Local n8n with `n8n-nodes-nextcloud` linked; Nextcloud API credential on the instance (JSON uses `Nextcloud account` / id `8UwpVTn1xgQ0s2g9` — change if yours differs).
2. Rebuild after Deck code changes: `npm run build` (and ensure `~/.n8n/custom` still links this package).

## `01-card-partial-update.json` → `Deck/card-partial-update`

Self-contained: Webhook → create board/stack/card → get → update title/description → get.

Assert: final title/description match the Update fields; `labels` / `assignedUsers` arrays still present on Get (empty unless you attach them in Nextcloud UI on a reused card).

```bash
n8n-cli workflow create --file=01-card-partial-update.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/deck-card-partial-update"
n8n-cli execution list --limit=3 --format=json
n8n-cli execution get <execution-id> --includeData --format=json
```

To refresh an existing workflow: `n8n-cli workflow update <id> --file=01-card-partial-update.json --format=json`.

## `02-move-smoke.json` → `Deck/move-smoke`

Webhook → create board + two stacks + card → move card to stack B. Smoke only (Move code unchanged in this slice).

```bash
n8n-cli workflow create --file=02-move-smoke.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/deck-move-smoke"
n8n-cli execution get <execution-id> --includeData --format=json
```

## Stronger labels check (optional)

Attach a label to a card in the Nextcloud Deck UI, then change the partial-update workflow to Get/Update that fixed board/card id instead of creating fixtures. Confirm the label survives Update.
