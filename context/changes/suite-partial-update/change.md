---
change_id: suite-partial-update
title: Suite partial update
status: impl_reviewed
created: 2026-07-22
updated: 2026-08-01
archived_at: null
---

## Notes

n8n docs MCP: https://docs.n8n.io/~gitbook/mcp (searchDocumentation, getPage).
No GET→whitelist→PUT cookbook in n8n docs — follow Update Fields / collection UX + in-repo patterns (Deck board whitelist, Files share sparse PUT).

Plan: `context/changes/suite-partial-update/plan.md` (+ `plan-brief.md`).

### Outcomes

- Suite Update contract: `context/foundation/update-convention.md` (linked from `context/foundation/README.md`).
- Live verification tradition: `test/n8n-cli/<app>/` — hybrid `@n8n/cli` (create/activate/inspect) + Webhook/`curl` to start (CLI has no execute); see `test/n8n-cli/README.md`.
- Shipped patterns: Deck card `buildCardUpdatePayload`; Calendar ICS AST patch + Update Fields; Files share Update Fields → sparse `buildShareUpdateBody`.
