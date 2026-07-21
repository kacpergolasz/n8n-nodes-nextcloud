# Validation Refactoring (F-02) Implementation Plan

## Overview

Replace production TypeScript `as Type` casts across the Nextcloud suite with runtime parsers (Zod + thin primitives) and `type`-based DTOs that assign cleanly to `IDataObject`. Migrate shared foundation first, then one phase per node (News paired with NewsTrigger), polish remaining typing boundaries next-to-last, and enforce with a parallel stricter ESLint config that does not touch locked `eslint.config.mjs` / `n8n.strict: true`. Credentials (credential type files and all `getCredentials` reads) are in scope with zero casts.

## Current State Analysis

- ~204 production `as` sites under `nodes/` (~113 on `getNodeParameter`). `credentials/*.credentials.ts` currently have no casts but are in lint scope going forward.
- Domain JSON entities are mostly `interface` + `[key: string]: unknown` (News/Deck), which blocks assignability to `IDataObject` and forces `entityJson` casts. Files `ParsedShare` is `interface` without index → `as unknown as IDataObject`.
- Proven patterns: `parseShareId(unknown)` (`nodes/NextcloudFiles/GenericFunctions.ts`), News `getLocatorValue` + `ensureType`, FilesTrigger field-rebuild outputs.
- Four duplicated `getCredentials` wrappers cast credential bags (`Files`/`Deck`/`News`/`Calendar` GenericFunctions).
- `n8n.strict: true` locks `eslint.config.mjs` to the `@n8n/node-cli` default; custom cast bans must live in a second flat config.
- Zod is Cloud-allowlisted and already a `n8n-workflow` peer; package has no Zod declaration yet.
- Research: `context/changes/validation-refactoring/research.md`. Reminders: `change.md` Notes.

### Key Discoveries:

- `IDataObject` / `JsonObject` are indexed `type`s — plain `type` aliases without `unknown` index assign; `interface` often does not (`research.md`).
- WebDAV `method as IHttpRequestMethods` (Files + Calendar) and poll→`ILoadOptionsFunctions` adapters (NewsTrigger + FilesTrigger) are the only likely long-lived boundaries after parsers land.
- `@n8n/node-cli/eslint` exports composable `config` — safe to spread into `eslint.safety.config.mjs` without modifying `eslint.config.mjs`.

## Desired End State

- Production `nodes/**` and `credentials/**` contain **no** `as T` / angle-bracket assertions except an audited, commented allowlist from Phase 7 (ideally only WebDAV method + poll adapters — **never** credentials).
- Shared `nodes/shared/parse.ts` (+ credential schema) is the suite entry for params, credentials, and `NodeApiError` payloads.
- Output DTOs used as `json` / `returnJsonArray` are `export type` without `[key: string]: unknown`.
- `npm lint` still = `n8n-node lint` (Cloud strict). `npm lint:safety` runs the stricter overlay and is wired into CI / `prepublishOnly` as a hard failure.
- `npm build`, `npm test`, and `npm lint` remain green after each node phase.

### Verification snapshot:

- `npm exec tsc --noEmit` (or package build typecheck path)
- `npm test`
- `npm lint`
- After Phase 8: `npm lint:safety` fails on new prod casts outside allowlist

## What We're NOT Doing

- Disabling `n8n.strict` or editing `eslint.config.mjs` away from the CLI default
- Adding Zod (or anything) to `dependencies` — **peerDependency only**
- Mandatory new unit-test suites for every parser (test bar = existing tests + typecheck; see `change.md` pre–impl-review reminder)
- Rewriting XML/ICS content parsers (`parseCalendarsFromXml`, etc.) unless they currently use avoidable `as` on node params / credentials
- S-15 pagination envelope work, OAuth feature work, or other roadmap slices
- Changing node UX / parameter definitions except where required to support `ensureType` / extractValue safely

## Implementation Approach

1. Introduce shared Zod peer + `parse.ts` helpers and a single credential schema/`type`.
2. Per node: convert output DTOs to `type`, replace param/response/credential casts with parsers/`ensureType`, delete `entityJson`-style assertions.
3. Pause for boundary allowlist (Phase 7): eliminate first, exempt last, document reasons.
4. Add `eslint.safety.config.mjs` that spreads official `config`, bans `as T` (allows `as const`), covers `nodes/**` + `credentials/**`, ignores tests; gate with `lint:safety`.

## Critical Implementation Details

- **Ordering:** Shared credential parser must exist before any node phase removes its local `getCredentials` cast. Do not leave two credential shapes in parallel longer than one phase.
- **Zod at call sites:** Prefer `schema.parse(raw)` / `safeParse` → `NodeOperationError` — never `as z.infer<typeof schema>`.
- **`n8n.strict`:** Phase 8 must not modify `eslint.config.mjs` contents. Use `eslint -c eslint.safety.config.mjs`.
- **Phase 7 gate:** Read `change.md` Notes and inventory remaining `as` before writing disable comments.

---

## Phase 1: Shared foundation

### Overview

Add Zod as a peer, create suite-wide parse helpers (including credentials and `NodeApiError` payloads), and document the DTO `type` convention so node phases have a single contract.

### Changes Required:

#### 1. Zod peerDependency

**File**: `package.json`

**Intent**: Declare Zod for Cloud-safe resolution without runtime `dependencies`.

**Contract**: `"peerDependencies": { "n8n-workflow": "*", "zod": "^3.25.67" }` (and ensure install still resolves via existing toolchain). Do not add `dependencies.zod`.

**Adaptation (implemented):** Zod is in `devDependencies` (`^3.25.67`), not `peerDependencies` / `dependencies`. Community-node lint only allows `n8n-workflow` (and optionally AI SDK) as peers and forbids runtime `dependencies`. Runtime still resolves host-provided Zod (Cloud allowlisted via `n8n-workflow`). See `change.md` §Implementation adaptations.

#### 2. Shared parse module

**File**: `nodes/shared/parse.ts` (new)

**Intent**: Centralize primitive parsers, credential parsing, and NodeApiError payload building.

**Contract**:
- Primitive helpers taking `unknown` (e.g. required string/boolean/number/positive int) throwing `Error` with user-facing messages — same spirit as `parseShareId`.
- `nextcloudCredentialSchema` via `z.object({…})`; `export type NextcloudCredentialData = z.infer<typeof nextcloudCredentialSchema>`; `parseNextcloudCredentials(raw: unknown): NextcloudCredentialData`.
- `nodeApiErrorPayload` (or similar) via `z.object({ message: z.string(), … })` returning a value assignable to `JsonObject` **without** `as`.
- Optional thin wrappers mapping Zod failures to thrown `Error` for node layers to wrap as `NodeOperationError`.

#### 3. Re-export / adopt path for existing coerces

**File**: `nodes/shared/pagination.ts` (touch only if needed)

**Intent**: Avoid duplicating `coerceFiniteNumber`; either re-export from `parse.ts` or leave pagination as-is and have parse.ts own required-field parsers only.

**Contract**: No behavior change to pagination in this phase unless a one-line re-export clarifies ownership.

#### 4. DTO convention note

**File**: `context/changes/validation-refactoring/change.md` (Notes) — optional one-liner if not already clear

**Intent**: Reminder that output DTOs use `export type` without `[key: string]: unknown`.

**Contract**: Notes only; no code.

### Success Criteria:

#### Automated Verification:

- Package installs / resolves `zod` for TypeScript imports from `nodes/shared/parse.ts`
- `npm exec tsc --noEmit` (or `npm build`) succeeds with the new module
- `npm lint` succeeds (`eslint.config.mjs` unchanged)
- `npm test` succeeds (no mandatory new tests)

#### Manual Verification:

- Confirm `package.json` has no `dependencies.zod` and `n8n.strict` still `true`
- Spot-check `parse.ts` exports are importable from a node file path (no circular import with pagination/poll modules)

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Files node

### Overview

Migrate Nextcloud Files production code off casts: params, share/file/folder outputs, OCS parsing edges, and credential reads via shared parser. Leave WebDAV method assertion for Phase 7 unless it can be removed cleanly.

### Changes Required:

#### 1. Credential + interface types

**Files**: `nodes/NextcloudFiles/FilesInterface.ts`, `nodes/NextcloudFiles/GenericFunctions.ts`

**Intent**: Use shared `NextcloudCredentialData` / `parseNextcloudCredentials`; convert `ParsedShare` / other JSON DTOs to `type` without `unknown` index; remove `getCredentials` cast.

**Contract**: `getCredentials` returns parsed type with no `as`. Share outputs assign to `json` without `as unknown as IDataObject`.

#### 2. Resource operations

**Files**: `nodes/NextcloudFiles/resources/**/*.ts`, `nodes/NextcloudFiles/NextcloudFiles.node.ts`, listSearch as needed

**Intent**: Replace `getNodeParameter(…) as …` with parsers / `ensureType` / extractValue; use shared NodeApiError payload helper instead of `as JsonObject`.

**Contract**: No prod `as` in Files resources/node/listSearch except possible WebDAV method line in GenericFunctions (deferred to Phase 7).

#### 3. Align `parseShareId` / private coercers

**File**: `nodes/NextcloudFiles/GenericFunctions.ts`

**Intent**: Prefer shared primitives where equivalent; keep domain `parseShare` but remove internal avoidable asserts where Zod/`type` suffice.

**Contract**: Public share parse behavior unchanged for callers; casts removed.

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds (existing Files tests)
- `npm lint` succeeds

#### Manual Verification:

- Grep Files prod paths for ` as ` — only expected boundary (method) if any
- Credential Test / one share op still conceptually sound (no live NC required if tests cover parsers)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Deck node

### Overview

Same cast removal for Deck: credentials, params, `entityJson`, API response asserts, `additionalFields` / merge paths.

### Changes Required:

#### 1. Types + credentials

**Files**: `nodes/NextcloudDeck/DeckInterface.ts`, `nodes/NextcloudDeck/GenericFunctions.ts`

**Intent**: `interface`→`type` for board/stack/card JSON; drop `unknown` index; shared credential parse.

**Contract**: `entityJson` helpers return `IDataObject` without `as`.

#### 2. Resources + resolveInput + node dispatch

**Files**: `nodes/NextcloudDeck/resources/**/*.ts`, `nodes/NextcloudDeck/resources/shared/**/*.ts`, `nodes/NextcloudDeck/NextcloudDeck.node.ts`, listSearch

**Intent**: Parsers for params/RLC; Zod or parse for `additionalFields` / response arrays; NodeApiError helper; `resource`/`operation` via parse/enum helper without `as string`.

**Contract**: No prod Deck `as` remaining (unless none deferred — Deck has no WebDAV method cast).

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds
- `npm lint` succeeds

#### Manual Verification:

- Grep Deck prod for ` as ` — expect zero (or only documented temporary leftovers headed to Phase 7)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: News + NewsTrigger

### Overview

Paired migration so News DTOs/parsers and NewsTrigger poll/staticData stay consistent. Remove entityJson casts, param casts, response unwrap casts, and credential casts; keep poll adapter cast only if still required until Phase 7.

### Changes Required:

#### 1. Shared News types + GenericFunctions

**Files**: `nodes/NextcloudNews/NewsInterface.ts`, `nodes/NextcloudNews/GenericFunctions.ts`, `nodes/NextcloudNews/resources/shared/**/*.ts`

**Intent**: `type` DTOs; shared credentials; strengthen `unwrap*` / `parseItemIds` path without asserts; keep/extend cast-free `getLocatorValue`.

**Contract**: `folderToJson` / `feedToJson` / `itemToJson` need no `as IDataObject`.

#### 2. News resources + node

**Files**: `nodes/NextcloudNews/resources/**/*.ts`, `nodes/NextcloudNews/NextcloudNews.node.ts`, listSearch

**Intent**: Param/response cast removal; NodeApiError helper.

**Contract**: No prod News `as` except none expected.

#### 3. NewsTrigger poll path

**Files**: `nodes/NextcloudNewsTrigger/**/*.ts` (exclude tests)

**Intent**: Validate staticData reads and node params via parsers; remove avoidable `as unknown` / RLC casts; defer only `asLoadOptionsContext`-style adapter if still required.

**Contract**: Poll behavior unchanged; casts limited to adapter candidate for Phase 7.

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds (News + NewsTrigger suites)
- `npm lint` succeeds

#### Manual Verification:

- Grep News + NewsTrigger prod for remaining ` as `
- Confirm entity output helpers are cast-free

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Calendar node

### Overview

Migrate Calendar params, credential dual-name path (Basic/OAuth), ICS/output shaping casts, and error payloads. Keep WebDAV method cast for Phase 7 if still required.

### Changes Required:

#### 1. Types + getCredentials

**Files**: `nodes/NextcloudCalendar/EventInterface.ts`, `nodes/NextcloudCalendar/GenericFunctions.ts`

**Intent**: Shared credential parse for whichever credential name Calendar selects; `type` for any JSON DTOs; remove `as IDataObject` / field `as string` credential assembly.

**Contract**: `getCredentials` cast-free for both credential types used by Calendar.

#### 2. Resources + node + listSearch

**Files**: `nodes/NextcloudCalendar/resources/**/*.ts`, `nodes/NextcloudCalendar/NextcloudCalendar.node.ts`, listSearch

**Intent**: Locator/param parsers; NodeApiError helper; avoidable response `as string` for ICS replaced with parse/narrow.

**Contract**: No Calendar prod `as` except possible method boundary.

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds
- `npm lint` succeeds

#### Manual Verification:

- Grep Calendar prod for remaining ` as `

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: FilesTrigger

### Overview

Migrate FilesTrigger poll/staticData/output paths; ensure any credential touch uses shared parser; defer poll adapter cast to Phase 7 if required.

### Changes Required:

#### 1. Poll + snapshot typing

**Files**: `nodes/NextcloudFilesTrigger/pollDirectory.ts`, related helpers, node + listSearch

**Intent**: Remove `as DirectorySnapshot` / `as IDataObject` where `type` assignability or parsers suffice; cast-free outputs already preferred — extend that pattern; NodeApiError helper.

**Contract**: No FilesTrigger prod `as` except possible loadOptions adapter.

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds
- `npm lint` succeeds

#### Manual Verification:

- Grep FilesTrigger prod for remaining ` as `

**Implementation Note**: Pause for manual confirmation before Phase 7. **Read `change.md` boundary reminder before starting Phase 7.**

---

## Phase 7: Boundary allowlist polish (next-to-last)

### Overview

Inventory every remaining production `as`. Eliminate what you can. For anything left (expected: WebDAV method ×2, poll adapters ×2), add precise file overrides and/or `eslint-disable-next-line` with a required reason comment. **Credentials must show zero remaining casts.** Prepare the allowlist the Phase 8 ESLint config will encode.

### Changes Required:

#### 1. Full inventory + elimination pass

**Files**: all `nodes/**/*.ts`, `credentials/**/*.ts` excluding tests

**Intent**: Last chance to remove casts via wrappers/types before exemptions.

**Contract**: Document remaining sites in `change.md` Notes (path:line + reason). Zero credential casts.

#### 2. Exception annotations

**Files**: only the remaining boundary files

**Intent**: Make exemptions auditable for Phase 8.

**Contract**: Each remaining `as` has `eslint-disable-next-line` (or equivalent) with reason, **or** is covered by a minimal file override listed for Phase 8. Prefer line-level over file-level.

### Success Criteria:

#### Automated Verification:

- `npm exec tsc --noEmit` / `npm build` succeeds
- `npm test` succeeds
- `npm lint` succeeds
- Grep confirms zero ` as ` under `credentials/`

#### Manual Verification:

- `change.md` lists every remaining allowlisted cast with rationale
- Human confirms no credential or avoidable param/response cast remains

**Implementation Note**: Pause for manual confirmation before Phase 8. Do not invent broad file overrides.

---

## Phase 8: ESLint safety overlay (last)

### Overview

Add a second flat ESLint config that copies/spreads the current `@n8n/node-cli` `config` (same baseline as `eslint.config.mjs`) and makes it stricter: ban type assertions except `as const`, apply to prod `nodes/**` + `credentials/**`, ignore tests, honor Phase 7 allowlist. Wire `lint:safety` as a hard gate.

### Changes Required:

#### 1. Safety config file

**File**: `eslint.safety.config.mjs` (new)

**Intent**: Extend official config without modifying `eslint.config.mjs`.

**Contract**:
- `import { config } from '@n8n/node-cli/eslint'` then `export default [ ...config, /* stricter blocks */ ]`
- Ban `as T` / angle-bracket; **allow `as const`** (restricted-syntax or equivalent — not raw `assertionStyle: 'never'` alone)
- `ignores` for `**/*.test.ts`, `**/test/**`, `dist`
- Encode Phase 7 allowlist (line disables already in source and/or narrow overrides)
- Must cover `credentials/**`

#### 2. Scripts + gate

**File**: `package.json`

**Intent**: Runnable and enforced safety lint.

**Contract**:
- `"lint:safety": "eslint -c eslint.safety.config.mjs ."`
- Wire into `prepublishOnly` and/or CI so release fails on violation (e.g. `prepublishOnly` runs safety after/before `n8n-node prerelease`, or document CI step if prepublish is the chosen gate — implementer picks the minimal hook that always runs before publish)
- Leave `"lint": "n8n-node lint"` unchanged

#### 3. Verify Cloud strict untouched

**File**: `eslint.config.mjs`

**Intent**: No content change.

**Contract**: Still exactly `import { config } from '@n8n/node-cli/eslint'; export default config;`

### Success Criteria:

#### Automated Verification:

- `npm lint` succeeds (strict mode / default config)
- `npm lint:safety` succeeds on the cleaned tree
- Introducing a deliberate prod `as string` in a non-allowlisted file causes `lint:safety` to fail
- `npm test` and build still succeed
- `n8n.strict` remains `true`; `eslint.config.mjs` unchanged from CLI default

#### Manual Verification:

- Confirm `prepublishOnly`/CI path actually invokes `lint:safety`
- Confirm tests and `as const` are not false-positives

**Implementation Note**: After this phase, F-02 enforcement is live. Consider `/10x-impl-review` with the light-test reminder in `change.md`.

---

## Testing Strategy

### Unit Tests:

- No mandate to add new parser unit tests (decision 7A). Existing Vitest suites must stay green each phase.
- If a phase introduces subtle coerce behavior, prefer extending an existing nearby test file only when cheap — not required for phase exit.

### Integration Tests:

- None required for this change.

### Manual Testing Steps:

1. After each node phase: grep that node’s prod tree for ` as `.
2. After Phase 7: read allowlist in `change.md`; confirm credentials clean.
3. After Phase 8: run `lint` + `lint:safety`; sanity-check a forbidden cast fails safety.
4. Before impl-review: re-read `change.md` test-bar reminder.

## Performance Considerations

Parsers add negligible CPU vs HTTP. Prefer `safeParse` only where branching is clearer; hot paths may use `parse` + catch→`NodeOperationError`.

## Migration Notes

- Land shared credential `type` once; delete duplicate `NextcloudCredentialData` interfaces per node as each phase adopts the shared export (avoid breaking mid-phase imports — update imports in the same phase).
- Do not publish mid-migration without `lint:safety` if Phase 8 already landed on the branch.

## References

- Research: `context/changes/validation-refactoring/research.md`
- Reminders: `context/changes/validation-refactoring/change.md`
- Roadmap F-02: `context/foundation/roadmap.md`
- Patterns: `nodes/NextcloudFiles/GenericFunctions.ts` (`parseShareId`), `nodes/NextcloudNews/resources/shared/resolveInput.ts`, `nodes/NextcloudFilesTrigger/pollDirectory.ts` (`changeToOutputItem`)
- ESLint export: `@n8n/node-cli/eslint` → `config`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared foundation

#### Automated

- [x] 1.1 Package installs / resolves `zod` for TypeScript imports from `nodes/shared/parse.ts` — 1443b13
- [x] 1.2 `npm exec tsc --noEmit` (or `npm build`) succeeds with the new module — 1443b13
- [x] 1.3 `npm lint` succeeds (`eslint.config.mjs` unchanged) — 1443b13
- [x] 1.4 `npm test` succeeds (no mandatory new tests) — 1443b13

#### Manual

- [x] 1.5 Confirm `package.json` has no `dependencies.zod` and `n8n.strict` still `true` — 1443b13
- [x] 1.6 Spot-check `parse.ts` exports are importable from a node file path (no circular import with pagination/poll modules) — 1443b13

### Phase 2: Files node

#### Automated

- [x] 2.1 `npm exec tsc --noEmit` / `npm build` succeeds — a058f5c
- [x] 2.2 `npm test` succeeds (existing Files tests) — a058f5c
- [x] 2.3 `npm lint` succeeds — a058f5c

#### Manual

- [x] 2.4 Grep Files prod paths for ` as ` — only expected boundary (method) if any — a058f5c
- [x] 2.5 Credential Test / one share op still conceptually sound (no live NC required if tests cover parsers) — a058f5c

### Phase 3: Deck node

#### Automated

- [x] 3.1 `npm exec tsc --noEmit` / `npm build` succeeds — df56a97
- [x] 3.2 `npm test` succeeds — df56a97
- [x] 3.3 `npm lint` succeeds — df56a97

#### Manual

- [x] 3.4 Grep Deck prod for ` as ` — expect zero (or only documented temporary leftovers headed to Phase 7) — df56a97

### Phase 4: News + NewsTrigger

#### Automated

- [x] 4.1 `npm exec tsc --noEmit` / `npm build` succeeds — 7cd0422
- [x] 4.2 `npm test` succeeds (News + NewsTrigger suites) — 7cd0422
- [x] 4.3 `npm lint` succeeds — 7cd0422

#### Manual

- [x] 4.4 Grep News + NewsTrigger prod for remaining ` as ` — 7cd0422
- [x] 4.5 Confirm entity output helpers are cast-free — 7cd0422

### Phase 5: Calendar node

#### Automated

- [x] 5.1 `npm exec tsc --noEmit` / `npm build` succeeds — d3c3c98
- [x] 5.2 `npm test` succeeds — d3c3c98
- [x] 5.3 `npm lint` succeeds — d3c3c98

#### Manual

- [x] 5.4 Grep Calendar prod for remaining ` as ` — d3c3c98

### Phase 6: FilesTrigger

#### Automated

- [x] 6.1 `npm exec tsc --noEmit` / `npm build` succeeds — a4e0375
- [x] 6.2 `npm test` succeeds — a4e0375
- [x] 6.3 `npm lint` succeeds — a4e0375

#### Manual

- [x] 6.4 Grep FilesTrigger prod for remaining ` as ` — a4e0375

### Phase 7: Boundary allowlist polish (next-to-last)

#### Automated

- [x] 7.1 `npm exec tsc --noEmit` / `npm build` succeeds
- [x] 7.2 `npm test` succeeds
- [x] 7.3 `npm lint` succeeds
- [x] 7.4 Grep confirms zero ` as ` under `credentials/`

#### Manual

- [x] 7.5 `change.md` lists every remaining allowlisted cast with rationale
- [x] 7.6 Human confirms no credential or avoidable param/response cast remains

### Phase 8: ESLint safety overlay (last)

#### Automated

- [ ] 8.1 `npm lint` succeeds (strict mode / default config)
- [ ] 8.2 `npm lint:safety` succeeds on the cleaned tree
- [ ] 8.3 Introducing a deliberate prod `as string` in a non-allowlisted file causes `lint:safety` to fail
- [ ] 8.4 `npm test` and build still succeed
- [ ] 8.5 `n8n.strict` remains `true`; `eslint.config.mjs` unchanged from CLI default

#### Manual

- [ ] 8.6 Confirm `prepublishOnly`/CI path actually invokes `lint:safety`
- [ ] 8.7 Confirm tests and `as const` are not false-positives
