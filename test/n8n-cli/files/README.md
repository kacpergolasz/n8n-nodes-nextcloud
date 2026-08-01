# Files — n8n-cli live tests

Hybrid tradition: [../README.md](../README.md). Workflow names: `Files/<test-name>`.

## Preconditions

1. Local n8n with `n8n-nodes-nextcloud` linked; Nextcloud API credential on the instance (JSON uses `Nextcloud account` / id `CwOIprgOYYtl3Kt9` — change if yours differs).
2. Rebuild after Files code changes: `npm run build` (and ensure `~/.n8n/custom` still links this package).

## `01-share-update-fields.json` → `Files/share-update-fields`

Self-contained: Webhook → create folder → create public link share (password + expireDate + publicUpload) → Update Fields `expireDate` only → Update Fields clear password + `publicUpload: false`.

Assert via `execution get`:
- After first Update: `expiration` reflects `2031-06-30` (server may return a datetime); permissions/`token` still present (sparse PUT — only expireDate was sent).
- After second Update: `publicUpload` is false; password cleared (link no longer password-protected in Nextcloud UI / share payload).

```bash
n8n-cli workflow create --file=01-share-update-fields.json --format=json
n8n-cli workflow activate <workflow-id>
curl -sS -X POST "http://localhost:5678/webhook/files-share-update-fields"
n8n-cli execution list --limit=3 --format=json
n8n-cli execution get <execution-id> --includeData --format=json
```

To refresh an existing workflow: `n8n-cli workflow update <id> --file=01-share-update-fields.json --format=json`.

Each run creates a new `/n8n-cli-files-<timestamp>` folder; clean up leftovers in Nextcloud Files when finished.
