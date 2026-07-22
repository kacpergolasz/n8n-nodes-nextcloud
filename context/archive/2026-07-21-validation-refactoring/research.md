---
date: 2026-07-21T15:39:05+02:00
researcher: kacpergolasz
git_commit: b0b25901eaf1ea2b99677c90d1a1ada3a2204ad2
branch: master
repository: n8n-nodes-nextcloud
topic: "F-02 validation refactoring: no prod casts, type (not interface) for IDataObject, Zod preference under n8n.strict"
tags: [research, codebase, validation, IDataObject, zod, n8n-strict, F-02]
status: complete
last_updated: 2026-07-21
last_updated_by: kacpergolasz
---

# Research: Validation refactoring (no prod casts / IDataObject / Zod)

**Date**: 2026-07-21T15:39:05+02:00  
**Researcher**: kacpergolasz  
**Git Commit**: b0b25901eaf1ea2b99677c90d1a1ada3a2204ad2  
**Branch**: master  
**Repository**: n8n-nodes-nextcloud

## Research Question

Make sure `IDataObject` issues are easily converted by using `type` instead of `interface`. No casting types in prod files (tests excluded). Check n8n docs / tooling for an opinionated approach; prefer Zod if n8n has no preference. Scope: full package F-02. Depth: decision-focused. Focus: architecture, n8n integration, migration. Constraint noted by requester: absolute “no cast” *lint rules* are hard while keeping `n8n.strict: true` in `package.json`.

## Summary

1. **~204 production `as` cast sites** (~64 files under `nodes/`). Roughly half are `getNodeParameter(…) as string|number|boolean|…`. The rest are `IDataObject`/entity output, API response asserts, `JsonObject` error payloads, WebDAV method unions, and poll→loadOptions adapters.
2. **`interface` → `type` (and drop `[key: string]: unknown`) is the fix for most `as IDataObject` / `as unknown as IDataObject` output casts.** Verified against `IDataObject`’s index signature (`GenericValue`); `interface` without a compatible index fails assignability; `type` aliases succeed; `unknown` index still fails.
3. **n8n docs do not prescribe Zod** for parameter validation (they show manual checks + `NodeOperationError`). **Zod is still the right default here**: it is on the **Cloud import allowlist**, already a **`peerDependency` of `n8n-workflow`**, and fills the roadmap F-02 unknown.
4. **`n8n.strict: true` is Cloud/ESLint lock-in, not a TypeScript cast ban.** With strict on, `eslint.config.mjs` must byte-match the CLI default — so you **cannot** add ESLint rules that ban `as` without disabling Cloud strict. Enforce no-casts via convention, review, and optional non-ESLint CI — not via custom eslint under strict.
5. **Keep a small allowlist of boundary casts** (WebDAV `IHttpRequestMethods`, poll context adapters, possibly `JsonObject` error bags) until n8n typings widen; everything else is F-02 in-scope.
6. **Canonical in-repo pattern already exists**: `parseShareId(value: unknown): number` + `NodeOperationError` wrap; News `getLocatorValue` + `ensureType: 'string'` avoids RLC casts.

## Detailed Findings

### F-02 roadmap framing

- [context/foundation/roadmap.md](../../foundation/roadmap.md) F-02: replace `as Type` casts with validation/parsing helpers; unknown is hand-rolled vs shared module vs Zod.
- No PRD FR for validation — quality foundation only.

### Cast inventory (prod only)

| Cluster | ~Count | Avoidable? | Notes |
|--------|--------|------------|--------|
| (a) `getNodeParameter` / params | ~113 | Yes | Primitives + RLC; replace with parsers / `ensureType` / Zod |
| (b) `IDataObject` / staticData / entityJson | ~19 | Mostly yes | Fixed by `type` shapes + field rebuilds; inbound staticData needs parsers |
| (c) API/HTTP response shaping | ~32 | Mostly yes | Mirror `parseShare`; binary/ArrayBuffer is a boundary |
| (d) WebDAV HTTP method union | 2 | **Keep** | Local `NextcloudHttpMethod` vs n8n `IHttpRequestMethods` |
| (e) Poll → `ILoadOptionsFunctions` | 2 | **Keep (for now)** | Context type mismatch |
| (f) Other (`JsonObject`, `error as Error`, credentials) | ~36 | Mixed | Prefer `unknown` narrowing; `JsonObject` may stay thin |

Representative sites:

- Param casts: `nodes/NextcloudFiles/resources/share/create.ts` (many), `nodes/NextcloudDeck/NextcloudDeck.node.ts:88-89`, `nodes/NextcloudNews/resources/item/getAll.ts:65-69`
- Entity → JSON casts: `nodes/NextcloudNews/resources/shared/entityJson.ts:5-14`, Deck twin, Files `share as unknown as IDataObject`
- Method boundary: `nodes/NextcloudFiles/GenericFunctions.ts:178`, `nodes/NextcloudCalendar/GenericFunctions.ts:127`
- Adapter: `nodes/NextcloudNewsTrigger/pollNews.ts:143`, `nodes/NextcloudFilesTrigger/pollDirectory.ts:35`

### `IDataObject` + type vs interface

`IDataObject` ([n8n-workflow `interfaces.d.ts`](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts) via local `node_modules/n8n-workflow/dist/esm/interfaces.d.ts:305-309`):

```ts
export interface IDataObject {
  [key: string]: GenericValue | IDataObject | GenericValue[] | IDataObject[];
}
```

| Shape | Assignable to `IDataObject`? |
|-------|------------------------------|
| `interface { id: number; … }` (no index) | **No** |
| `type { id: number; … }` (no index) | **Yes** |
| `interface`/`type` + `[key: string]: unknown` | **No** (`unknown` ⊄ `GenericValue`) |
| Field-by-field object literal | **Yes** (e.g. `changeToOutputItem`) |

Current domain JSON entities are mostly **`interface` + `[key: string]: unknown`** (`NewsInterface.ts`, `DeckInterface.ts`) → forces `entityJson` casts. Files `ParsedShare` is `interface` without index → forces `as unknown as IDataObject`.

**Recommendation:** For any shape that becomes `json` / `returnJsonArray` / staticData payload, use **`export type …` without `unknown` index**. Keep `interface` optional for non-JSON contracts (`*OperationContext`). Prefer Zod-inferred `type X = z.infer<typeof XSchema>` for structured inbound payloads.

### Existing patterns to standardize on

1. **`parseShareId(unknown) → number` throws** — `nodes/NextcloudFiles/GenericFunctions.ts:485-496`; call sites wrap with `NodeOperationError` (still `(error as Error)` in catch — replace with `unknown` narrowing).
2. **`parseItemIds`**, private `asString`/`asNumber`/`asBoolean` inside `parseShare`, `coerceFiniteNumber` in `nodes/shared/pagination.ts`.
3. **Cast-free RLC reads** — `getLocatorValue` with `extractValue` + `ensureType: 'string'` + `skipValidation` (`nodes/NextcloudNews/resources/shared/resolveInput.ts:10-28`).
4. **Cast-free output** — `changeToOutputItem` rebuilds fields (`pollDirectory.ts:114-128`) vs News/Deck spread+cast.

### n8n docs / tooling opinion (Context7 + local CLI)

- **Docs:** Parameter validation example is manual + `NodeOperationError` ([error-handling](https://docs.n8n.io/integrations/community-nodes/build/reference/error-handling/)); no Zod mandate for nodes.
- **Linter / Cloud:** `@n8n/community-nodes/no-restricted-imports` **allowlist includes `zod`** (with `n8n-workflow`, `lodash`, `luxon`, …) — `node_modules/@n8n/node-cli/.../no-restricted-imports.md`.
- **`n8n.strict: true`:** Requires default `eslint.config.mjs` unchanged (`lint.js` `checkStrictMode` / `verifyEslintConfig`). Custom “ban `as`” ESLint rules ⇒ must set `strict: false` and lose Cloud eligibility via `n8n-node cloud-support disable`.
- **Zod availability:** `n8n-workflow` lists `zod` as **peerDependency** (`3.25.67`); package already resolves `zod` via the toolchain. Prefer declaring `zod` as **peerDependency** (not `dependencies`) to stay Cloud/runtime-deps friendly. Current package has empty runtime `dependencies`.

### Zod usage guidance (no prod assertions)

- Input: `unknown` (from `getNodeParameter`, HTTP JSON, staticData slots).
- `schema.parse(raw)` / `safeParse` → typed `z.infer<typeof schema>` — **no `as T` needed** at call sites.
- Map Zod failures → `NodeOperationError` with `itemIndex` (n8n docs style).
- Keep thin hand-rolled primitives (`parsePositiveInt`) where Zod is overkill; or wrap them as shared Zod schemas once.
- Avoid the generic `parseData` pattern that Context7 shows with `as z.infer<T>` — prefer direct `schema.parse` so inference flows without assertions.

### Why “no cast rules” clash with `n8n.strict`

User concern is valid for **enforcement**, not for **implementation**:

| Approach | Compatible with `n8n.strict: true`? |
|----------|-------------------------------------|
| Rewrite code to parsers / `type` / Zod | **Yes** |
| Convention + PR checklist / review | **Yes** |
| Custom ESLint rule banning `as` | **No** (breaks locked `eslint.config.mjs`) |
| Separate CI script (`rg` / ts-morph) outside eslint | **Yes** (does not touch eslint config) |

Recommended policy: **zero `as` in prod `nodes/**` and `credentials/**` except an explicit allowlist file/comment for boundaries (d)+(e)[+ JsonObject if needed]**; enforce with review + optional non-ESLint CI; tests exempt.

## Code References

- `package.json:31-33` — `"n8n": { "strict": true }`
- `tsconfig.json` — TypeScript `"strict": true` (separate from n8n.strict)
- `eslint.config.mjs` — default `@n8n/node-cli/eslint` config only
- `nodes/NextcloudFiles/GenericFunctions.ts:485-496` — `parseShareId`
- `nodes/NextcloudNews/resources/shared/resolveInput.ts:10-28` — cast-free locator
- `nodes/NextcloudNews/resources/shared/entityJson.ts:5-14` — `as IDataObject` hotspot
- `nodes/NextcloudNews/NewsInterface.ts:12-45` — `interface` + `unknown` index
- `nodes/NextcloudFilesTrigger/pollDirectory.ts:114-128` — cast-free output builder
- `node_modules/n8n-workflow/dist/esm/interfaces.d.ts:305-309` — `IDataObject`
- `node_modules/@n8n/node-cli/.../no-restricted-imports.md` — Zod allowlisted

## Architecture Insights

1. **Two different problems:** (A) compile-time assignability into `IDataObject` → fix with `type` aliases; (B) runtime trust of params/API JSON → fix with parse/Zod. Casting papers over both.
2. **Shared module:** `nodes/shared/parse.ts` (or `validation.ts`) for suite-wide primitives + Zod helpers; domain schemas stay near each app; content XML/ICS parsers stay as-is (not F-02).
3. **`ensureType` / `extractValue` first** for RLC and known scalar params where n8n already coerces; Zod/parsers for collections, `additionalFields`, OCS envelopes, staticData.
4. **Do not disable `n8n.strict` to “get lint rules”** unless Cloud eligibility is abandoned; Zod + parsers work under strict today.

## Historical Context (from prior changes)

- `context/archive/2026-07-18-nextcloud-files-drive/plan.md` — keep WebDAV method cast at HTTP boundary; introduce `parseShare`
- Same change review — shareId validation → `parseShareId`
- `context/archive/2026-07-19-suite-polling-triggers/plan.md` — poll helpers prefer `IDataObject`-compatible plain records
- `context/changes/zahidcoder-adopt-or-rewrite/frame.md` — this package already on `@n8n/node-cli` + `strict: true`

## Related Research

- `context/archive/2026-07-20-nextcloud-news/research.md` — News suite (poll/staticData adjacent)
- `context/archive/2026-07-19-suite-polling-triggers/research.md` — shared poll helpers

## Open Questions

1. **Allowlist exact set:** Is `as JsonObject` for `NodeApiError` acceptable long-term, or should a small `toJsonObject(message, extras?)` helper return a typed value without assertion?
2. **Zod version pin:** Peer to `n8n-workflow`’s `3.25.67` vs `zod@^3` — confirm against target n8n runtime before plan lock.
3. **CI enforcement without ESLint:** Prefer `rg`-based check on `nodes/**` excluding `test/` + allowlist paths, or skip automation in v1?
4. **Phased blast radius:** Full-package outcome vs ship shared module + Files share pilot first (recommended) then Deck → News → Calendar → Triggers.

## Recommended decisions (for `/10x-plan`)

1. Adopt **Zod** (peerDependency; Cloud-allowlisted) for structured params/responses; keep/share **primitive parsers** à la `parseShareId`.
2. Convert **output DTOs** to **`type` without `unknown` index**; delete `entityJson` casts.
3. **No `as` in prod** except documented boundaries (HTTP method, poll adapters; revisit JsonObject).
4. **Do not** customize ESLint under `n8n.strict`; enforce via convention (+ optional non-ESLint CI).
5. Migration order: shared helpers → Files share (reference) → Deck → News/NewsTrigger → Calendar/Files/FilesTrigger → dispatch enums + response unwraps.
