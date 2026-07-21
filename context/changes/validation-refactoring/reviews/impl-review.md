<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Validation Refactoring (F-02)

- **Plan**: context/changes/validation-refactoring/plan.md
- **Scope**: Phases 1–8 of 8 (full plan)
- **Date**: 2026-07-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations
- **Triage**: F1 FIXED (Fix A), F2 FIXED, F3 ACCEPTED, F4 FIXED, F5 FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Zod remains a `devDependency` with residual publish/runtime risk

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: package.json:49-56
- **Detail**: Documented Phase 1 adaptation (community-node lint blocks non-allowlisted peers / runtime `dependencies`; Cloud expects host-provided Zod via `n8n-workflow`). `dist` still `require`s `zod` from `nodes/shared/parse.js`. Self-hosted / clean consumer installs that do not hoist Zod from the host may fail at runtime even though `lint:safety` and typecheck are green. Prior phase-1–6 review accepted this as an observation; with Phase 8 complete and publish gated, it is the main remaining architectural risk.
- **Fix A ⭐ Recommended**: Keep `devDependencies` placement; add an explicit release/README note that Zod must be resolvable from the n8n host (Cloud allowlisted; self-hosted via n8n's own install), and optionally a smoke check in CI that `require.resolve('zod')` works under a simulated consumer layout.
  - Strength: Respects `n8n.strict` / community-node lint; matches documented adaptation.
  - Tradeoff: Does not make the package self-contained for odd install graphs.
  - Confidence: HIGH — this is the intended Cloud model.
  - Blind spot: Exact n8n self-hosted node_modules layout for community packages not verified in this review.
- **Fix B**: Bundle Zod into the published `dist` (or vendor a minimal subset) so the package does not depend on host resolution.
  - Strength: Self-contained runtime.
  - Tradeoff: May fight Cloud/community packaging rules; larger artifact; duplicate Zod copies.
  - Confidence: LOW — packaging policy may forbid it.
  - Blind spot: Whether Cloud verification rejects bundled Zod.
- **Decision**: FIXED (via Fix A — README + change.md host-Zod notes; CI smoke skipped)

### F2 — `lint:safety` does not ban non-null assertions (`!`)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: eslint.safety.config.mjs:22-27
- **Detail**: Phase 8 contract bans `as T` via `assertionStyle: 'never'` (`as const` allowed). Non-null assertions (`x!`) are a separate escape hatch and are not covered. Prod tree currently has no `!.` usage; this is a loophole for future code, not a present violation.
- **Fix**: Optionally add `@typescript-eslint/no-non-null-assertion: 'error'` on the same prod globs.
- **Decision**: FIXED

### F3 — `assertHttpMethodIsValid` widens WebDAV verbs to `IHttpRequestMethods`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: nodes/shared/assertHttpMethodIsValid.ts:12-14
- **Detail**: Assertion predicate claims `method is IHttpRequestMethods` after allowing PROPFIND/MKCOL/MOVE/COPY, which are not in n8n's union. Runtime allowlist is correct; this is the intentional Phase 7 replacement for `as IHttpRequestMethods`. Documented in the helper and `change.md`.
- **Fix**: No code change required. Keep as the documented HTTP boundary; avoid reintroducing `as` allowlists.
- **Decision**: ACCEPTED (intentional Phase 7 boundary; no code change)

### F4 — News `unwrap*` returns `[]` on unrecognized envelopes

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: nodes/NextcloudNews/GenericFunctions.ts:196-232
- **Detail**: After Zod entity parsers throw on bad array elements, unrecognized top-level shapes still soft-return `[]`, which can look like an empty success. Pre-existing soft-empty pattern; not a Phase 7–8 regression. Ids were tightened in prior triage (`int().positive()`).
- **Fix**: Optionally throw when an object envelope is present but missing/invalid `folders`/`feeds`/`items`; keep `[]` only for true empty lists.
- **Decision**: FIXED

### F5 — Deck/Calendar request helpers still use narrower context unions

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: nodes/NextcloudDeck/GenericFunctions.ts; nodes/NextcloudCalendar/GenericFunctions.ts
- **Detail**: Files/News adopted `NextcloudRequestContext` (`ILoadOptionsFunctions | IExecuteFunctions | IPollFunctions`). Deck/Calendar still type helpers as `ILoadOptionsFunctions | IExecuteFunctions` only — fine because they have no poll path, but mildly inconsistent.
- **Fix**: Adopt `NextcloudRequestContext` when next touching those helpers; not a Phase 8 blocker.
- **Decision**: FIXED

## Success criteria evidence (Phases 1–8)

| Check | Result |
|-------|--------|
| `npm exec tsc -- --noEmit` | PASS (exit 0) |
| `npm test` | PASS (19 files / 235 tests) |
| `npm run lint` | PASS (0 errors; 8 pre-existing icon warnings) |
| `npm run lint:safety` | PASS (0 errors; same icon warnings) |
| `dependencies.zod` absent | PASS |
| `n8n.strict === true` | PASS |
| `eslint.config.mjs` unchanged CLI default | PASS |
| `prepublishOnly` invokes `lint:safety` | PASS |
| CI `.github/workflows/ci.yml` runs `lint:safety` | PASS |
| credentials/ prod `as` | PASS (zero) |
| nodes/ prod `as T` | PASS (zero; 5× `as const` only) |
| Phase 7 allowlist in `change.md` | PASS (“Allowlisted remaining casts: none”) |
| Prior triage F1–F10 still present | PASS |

## Progress manual items

Phases 1–8 Manual Progress rows are all `[x]`. Phase 7–8 greps / allowlist / CI wiring verified in this review. No rubber-stamp red flags.

## Prior review note

Phases 1–6 were reviewed earlier the same day (10 findings, all FIXED via triage). This report replaces that scope with a full Phases 1–8 review after Phase 7–8 landed.
