# Frame Brief: Adopt zahidcoder package vs rewrite

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Existing community package [zahidcoder/n8n-nodes-nextcloud](https://github.com/zahidcoder/n8n-nodes-nextcloud) claims Deck/Notes/Tables/Talk (+ files/folders/sharing), while `context/foundation/` targets a Google-mirror Nextcloud suite (separate app nodes, shared credentials, Calendar-first, News, polling, resource pickers).

## Initial Framing (preserved)

- **User's stated cause or approach**: Either that package is a viable base to continue from, or it is not and we should write from scratch under `packages/nextcloud/`.
- **User's proposed direction**: Pick fork-and-extend vs rewrite before more planning/implementation.
- **Pre-dispatch narrowing**: Leading concerns are (1) coverage gap vs PRD, (2) architecture/UX fit (monolith vs suite nodes), (3) code quality/maintainability — treated as equally important.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Coverage gap** — package may lack Calendar, News, polling, pickers → cannot satisfy north star / must-haves without greenfield features anyway ← initial framing (1)
2. **Architecture / UX fit** — monolith Resource dropdown fights Google-mirror separate-app-node product goal ← initial framing (2)
3. **Code quality / maintainability** — thin one-commit package costs more to rehabilitate than rebuild on starter ← initial framing (3)
4. **Salvage economics** — Deck/Talk/Files OCS mappings might still make “fork + reshape” cheaper than rewrite despite gaps

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Coverage gap blocks adopt | No Calendar/CalDAV, News, Contacts, polling, webhooks, or `loadOptions`/`listSearch`/`resourceLocator`. Deck is boards-only (README claims Cards/Stacks). Files + Talk + Basic/OAuth2 present. Clone: `_investigate_zahidcoder_nextcloud/nodes/NextCloud/NextCloud.node.ts` resources at L90–126; `package.json` registers one action node. | **STRONG** |
| Architecture mismatch | Single `NextCloud` node (~3409 LOC) with Resource dropdown; WebDAV-URL credential (`nextCloudApi`). PRD wants separate suite nodes + shared `baseUrl` credential. Prior art `packages/nextcloud backup/calendar/` already has `Nextcloud Calendar` + `nextcloudApi` + pickers. Local scaffold already on `@n8n/node-cli` + `strict: true`. | **STRONG** |
| Code quality too weak | 1 commit (`011cf3f`); `strict: false`; no tests/CI; lint script with no eslint dep; execute fall-through after Deck/Notes/Tables/Talk into empty-endpoint WebDAV request (`NextCloud.node.ts` L3189–3210 after app handlers that already `returnData.push`). README overclaims. | **STRONG** |
| Salvage still justifies fork | Talk/Deck/Notes/Tables endpoint maps exist and Calendar backup does not cover them. Independent pressure-test: adopt only rational if splitting those execute bodies is faster than re-deriving APIs *and* UX debt is acceptable. Against 2-week after-hours + Calendar-first hard constraint, salvage ≠ foundation. | **WEAK** (as adopt-as-base); **STRONG** (as scrap reference) |

## Narrowing Signals

Step 3 evidence was conclusive across all three leading concerns; Step 4 questioning skipped.

- North star (S-01 Calendar + Basic Auth + pickers) is absent in zahidcoder and already present in local Calendar prior art.
- Product UX (separate app nodes) requires structural rewrite of the only node surface — not incremental extension.
- Execute fall-through + god-file + toolchain gap make rehabilitation ≈ rebuild cost with worse starting shape.

## Cross-System Convention

n8n Google suite and local prior art both use **per-app nodes** sharing a credential, with modular descriptions/`listSearch`. Official community packaging is `@n8n/node-cli` + CI (already in `packages/nextcloud/`). zahidcoder matches an older monolith WebDAV-extension pattern (closer to core’s thin file node), not the PRD’s Google-mirror convention.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: do not adopt zahidcoder as the package foundation — rewrite on `packages/nextcloud/` + Calendar prior art, and treat zahidcoder only as an endpoint cheat-sheet for Deck/Talk/(optional Notes/Tables).

The fork-vs-rewrite binary was slightly misframed as “is the package good enough?” Evidence says the deciding factor is **product-shape incompatibility** (monolith + WebDAV credential + no Calendar), amplified by coverage holes and quality debt. Salvaging API maps remains useful; inheriting the architecture does not.

## Confidence

- **HIGH** — all three user concerns have strong evidence; pressure-test independently landed on the same deciding factor (panel shape + Calendar-first vs monolith); salvage-as-base is weak under the stated 2-week budget.

## What Changes for /10x-plan

Plan **F-01 / S-01 on the local scaffold**, porting Calendar prior art patterns (`baseUrl` credential, separate `Nextcloud Calendar` node, resource pickers). Do **not** plan phases around forking zahidcoder’s node tree. Optionally park a short “endpoint reference from zahidcoder” note when planning S-04/S-05 (Deck/Talk).

Also note: both packages claim npm name `n8n-nodes-nextcloud` — publish strategy must account for the existing `0.1.x` on npm (ownership/rename), but that is secondary to the architecture decision.

## References

- Remote: https://github.com/zahidcoder/n8n-nodes-nextcloud (commit `011cf3f`)
- Local clone (investigation): `packages/_investigate_zahidcoder_nextcloud/` (duplicate `_tmp_zahid_nextcloud/` safe to delete)
- PRD / roadmap: `context/foundation/prd.md`, `context/foundation/roadmap.md`
- Closer base: `packages/nextcloud/` (node-cli scaffold), `packages/nextcloud backup/calendar/`
- Investigation agents: coverage, architecture, quality, independent pressure-test
