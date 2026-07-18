---
starter_id: local-n8n-community-node
package_manager: npm
project_name: n8n-nodes-nextcloud
hints:
  language_family: js
  team_size: solo
  deployment_target: npm
  ci_provider: github-actions
  ci_default_flow: manual-promotion
  bootstrapper_confidence: best-effort
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
  # Outside curated registry — do NOT run /10x-bootstrapper.
  # Scaffold source: /home/kacper/Dev/n8n/starter (@n8n/node-cli, TypeScript).
  # Auth/DB are hosted by n8n; this package only defines credentials + nodes.
---

## Why this stack

This is an n8n community node library, not a web/SaaS app. The curated starter registry has no cell for that product, so the stack is the local official-style pack at `starter/` — TypeScript, `@n8n/node-cli`, `n8n-community-node-package` layout, GitHub Actions lint/build CI already present. Auth and persistence stay inside n8n; the package only ships shared credentials and suite nodes. Soft avoids were none beyond rejecting web/SaaS scaffolds and databases. Deploy surface is npm publish after local community-node verification; CI is GitHub Actions with manual release promotion. Bootstrapper confidence is best-effort because this `starter_id` is outside the registry — copy/adapt from `starter/` (or use the repo's n8n-node-scaffold skills) instead of running `/10x-bootstrapper`.
