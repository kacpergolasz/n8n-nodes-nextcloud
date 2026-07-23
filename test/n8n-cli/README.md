# n8n-cli live verification

Suite tradition for proving Nextcloud node behavior against a **local n8n instance** with this community package linked. Artifacts live under `test/n8n-cli/<app>/`. They are **not** Vitest cases.

## Hybrid model

`@n8n/cli` (0.11.x) has **no execute/run command**. Split responsibilities:

| Responsibility | Tool |
| --- | --- |
| Workflow CRUD + activate | `n8n-cli` / `npx @n8n/cli` — `workflow create\|update\|get\|activate` |
| Inspect runs | `execution list\|get` |
| **Start** a live run | **Webhook** trigger + `curl` (after activate) |
| Debug fallback | Manual Execute in the n8n editor |

Prefer `--format=json` for scripting and assertions.

## Prerequisites

1. Local n8n running with this package linked (build + `npm link` into `~/.n8n/custom` — see root README “Verification gate”).
2. A Nextcloud API (or OAuth2) credential already on the instance. Reference it in workflow JSON by name/id — **never commit secrets**.
3. API access for `@n8n/cli` via env (`N8N_URL`, `N8N_API_KEY`) or `npx @n8n/cli config` (`set-url` / `set-api-key`). Resolution order: flags → env → `~/.n8n-cli/config.json`.

Create an API key under **n8n → Settings → n8n API**.

Sanity check:

```bash
npx @n8n/cli workflow list --format=json
```

## Layout

```
test/n8n-cli/
  README.md          ← this file (suite tradition)
  deck/              ← Deck live workflows + README
  calendar/          ← Calendar live workflows + README
  files/             ← Files live workflows + README
```

Each app folder holds:

- One or more **Webhook-triggered** workflow JSON files
- A short `README.md` with create → activate → curl → inspect steps and app-specific preconditions (board/card IDs, calendar slug, share id, etc.)

## Typical run loop

From an app folder (example: `deck/`):

```bash
# 1. Create (or update) the workflow from JSON
cat 01-card-partial-update.json | npx @n8n/cli workflow create --stdin --format=json
# note the returned workflow id; patch credential ids if the create rejects unresolved refs

# 2. Activate (required for Webhook path)
npx @n8n/cli workflow activate <workflow-id>

# 3. Start via webhook (path/method from the Webhook node in the JSON)
curl -sS -X POST "http://localhost:5678/webhook/<path>"

# 4. Inspect
npx @n8n/cli execution list --limit=5 --format=json
npx @n8n/cli execution get <execution-id> --format=json
```

Production-style webhook URLs use `/webhook/…` after activate. Use `/webhook-test/…` only when testing from the editor’s “Listen” mode.

**Fallback:** open the workflow in the editor and use Manual Execute when debugging a single node path (workflows may still include a Webhook for the CLI loop).

## Credentials and secrets

- Do **not** commit API keys, app passwords, webhook auth material, or Nextcloud credentials.
- Workflow JSON may reference credentials by placeholder name/id; replace locally before create, or edit in the UI after import.
- Webhook auth (if enabled) belongs in env/local config only.

## What not to claim

- Do **not** document `n8n-cli workflow execute` / `run` — those commands do not exist in `@n8n/cli`.
- Do **not** treat these folders as unit tests; CI stays on Vitest under `nodes/*/test/`.
