# Validation Refactoring (F-02) — Plan Brief

> Full plan: `context/changes/validation-refactoring/plan.md`
> Research: `context/changes/validation-refactoring/research.md`

## What & Why

Remove production `as Type` casts across the Nextcloud suite by validating with Zod/parsers and using `type` (not `interface`) for `IDataObject`-bound shapes — including all credential reads — then enforce with a parallel stricter ESLint config while keeping Cloud `n8n.strict: true`.

## Starting Point

~204 prod casts (mostly `getNodeParameter`); duplicate `getCredentials` asserts; News/Deck `interface` + `unknown` index blocking clean `json` assignability. `parseShareId` / `ensureType` locators already show the target pattern. `eslint.config.mjs` is locked to the CLI default.

## Desired End State

Suite nodes and credentials are cast-free except an audited boundary allowlist (WebDAV method / poll adapters only). Shared `nodes/shared/parse.ts` owns primitives, credentials, and `NodeApiError` payloads. `pnpm lint:safety` hard-fails new prod casts; `pnpm lint` stays Cloud-clean.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Validation library | Zod peer `^3.25.67` | Cloud-allowlisted; already `n8n-workflow` peer; docs have no alternate mandate | Research + Plan |
| DTO shapes | `type`, no `unknown` index | Fixes `IDataObject` assignability without casts | Research |
| Credentials | In scope; zero casts | Shared Zod schema + parse; all node `getCredentials` migrate | Plan |
| `NodeApiError` bags | `zod.object` helper | Assigns to `JsonObject` without `as JsonObject` | Plan |
| Phase shape | Shared → per node → allowlist → ESLint | User: phases per node; ESLint last; allowlist next-to-last | Plan |
| Node order | Files → Deck → News+NewsTrigger → Calendar → FilesTrigger | Files has reference parsers; News paired with trigger | Plan |
| Test bar | Typecheck + existing tests only | Speed; pre–impl-review reminder in `change.md` | Plan |
| ESLint enforcement | Second flat config; ban `as T`, allow `as const`; gate CI/`prepublishOnly` | Keeps `n8n.strict`; real safety net | Research + Plan |
| Boundaries | Eliminate first; line disables + reasons | Precision over file-wide escapes | Plan |

## Scope

**In scope:** Shared parse/credential helpers; all suite nodes + triggers; credentials; DTO `type` migration; boundary polish; `eslint.safety.config.mjs` + `lint:safety` gate.

**Out of scope:** Editing default `eslint.config.mjs` / disabling `n8n.strict`; Zod in `dependencies`; mandatory new parser unit-test suites; XML/ICS content-parser rewrites; other roadmap slices.

## Architecture / Approach

`unknown` in → Zod/primitive parse out → typed `type` DTOs assign to `IDataObject`/`JsonObject`. Official lint unchanged; safety lint spreads `@n8n/node-cli` `config` and adds assertion bans. Phase 7 inventories exemptions before Phase 8 encodes them.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared foundation | Zod peer + `parse.ts` + credential schema | Wrong peer range vs host |
| 2. Files | First full node cast-free (method maybe left) | Share/OCS edge cases |
| 3. Deck | Deck cast-free | `additionalFields` / merge typing |
| 4. News + NewsTrigger | Paired DTO/poll cleanup | StaticData + adapter boundary |
| 5. Calendar | Dual credential path cast-free | OAuth vs Basic name selection |
| 6. FilesTrigger | Trigger cast-free (adapter maybe left) | Snapshot typing |
| 7. Boundary allowlist | Audited exceptions only; credentials = 0 | Over-broad overrides |
| 8. ESLint safety | `lint:safety` hard gate | False positives on `as const` / tests |

**Prerequisites:** Research complete; `n8n.strict: true` stays on.
**Estimated effort:** ~4–6 sessions across 8 phases

## Open Risks & Assumptions

- WebDAV method + poll adapters may remain as the only allowlisted `as` sites after Phase 7
- Light test bar means impl-review must scrutinize parser correctness (`change.md` reminder)
- Zod peer range `^3.25.67` must stay compatible with the target n8n runtime

## Success Criteria (Summary)

- No avoidable prod casts; credentials fully cast-free
- Shared parsers used suite-wide; DTOs assign to `IDataObject` without asserts
- Cloud `lint` green; `lint:safety` enforces the ban going forward
