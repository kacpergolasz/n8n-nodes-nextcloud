# Local community-node verification path — Plan Brief

> Full plan: `context/changes/local-community-node-verify/plan.md`

## What & Why

Make `n8n-nodes-nextcloud` verifiable in a local n8n instance via the official community-node link path (FR-003 / roadmap F-01) before any Nextcloud suite work. Without this, Calendar and later slices cannot be proven end-to-end in n8n.

## Starting Point

Package is still starter-shaped: correct `name`, empty/placeholder identity, Example + GithubIssues registered, README documents only `npm run dev`. Official docs require `build` → `npm link` → link into `~/.n8n/custom` → `n8n start`.

## Desired End State

Minimal package identity filled; README documents link-as-gate and `dev` as day-to-day; `build`/`lint` pass; searching the n8n panel for `Example` after the link path shows the canary from this package.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Verify mode | Link path = gate; `npm run dev` = day-to-day | Matches FR-003 + official docs while keeping fast iteration | Plan |
| Smoke target | Keep starter Example/GithubIssues | Prove load without pulling S-01 Calendar into F-01 | Plan |
| Metadata | Minimal identity only | Enough for a real package without a full README rewrite | Plan |
| Docs home | Short README section | Contributors look here first; cite official docs | Plan |
| Success bar | build + lint + manual panel check | Half agent-runnable; panel proves nodes actually load | Plan |

## Scope

**In scope:** `package.json` identity fields; README dual-path local verify; build/lint; manual link-path panel check for canaries.

**Out of scope:** Nextcloud nodes/credentials; stripping canaries; full README_TEMPLATE rewrite; npm publish; CI changes; automating the browser check.

## Architecture / Approach

No new runtime architecture. Identity + docs unlock a human/agent verify loop: automated build/lint, then official npm-link into `~/.n8n/custom` so canary nodes appear when searching by node name (`Example`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Minimal package identity | Non-empty description/author/repository | Wrong repo URL if monorepo layout confuses consumers |
| 2. README dual-path local verify | Gate + day-to-day documented | Readers still follow only `dev` if gate isn’t prominent |
| 3. Prove the gate | build/lint + panel canary | Missing `~/.n8n/custom` or searching package name instead of `Example` |

**Prerequisites:** Node/npm; ability to install n8n globally for the gate path; write access to `~/.n8n/custom`.
**Estimated effort:** ~1 session across 3 thin phases

## Open Risks & Assumptions

- Author/email from git config (`kacpergolasz` / `kgolasz@outlook.com`) are acceptable for `package.json`
- Repository URL points at the monorepo remote until a dedicated package repo exists
- Global `n8n` version is new enough to load current community-node packages

## Success Criteria (Summary)

- Package identity has no empty/placeholder author or repository fields
- README teaches both `npm run dev` and the official link gate (with docs link)
- After link path, `Example` appears in the n8n node panel; build and lint pass
