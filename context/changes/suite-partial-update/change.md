---
change_id: suite-partial-update
title: Suite partial update
status: plan_reviewed
created: 2026-07-22
updated: 2026-07-23
archived_at: null
---

## Notes

n8n docs MCP: https://docs.n8n.io/~gitbook/mcp (searchDocumentation, getPage).
No GET→whitelist→PUT cookbook in n8n docs — follow Update Fields / collection UX + in-repo patterns (Deck board whitelist, Files share sparse PUT).

Plan: `context/changes/suite-partial-update/plan.md` (+ `plan-brief.md`).
Live verification tradition: `test/n8n-cli/<app>/` — hybrid `@n8n/cli` (create/activate/inspect) + Webhook/`curl` to start (CLI has no execute).
Suite convention lands in Phase 6: `context/foundation/update-convention.md`.
