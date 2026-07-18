# Local community-node verification path Implementation Plan

## Overview

Establish a repeatable local verification path for `n8n-nodes-nextcloud` so every later suite slice can be proven in a real n8n instance before npm publish. Fill minimal package identity, document the dual run modes (official npm-link as the gate; `npm run dev` for day-to-day), keep starter Example/GithubIssues as canaries, and prove `build` + `lint` plus a manual node-panel load via the [run-your-node-locally](https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally) path.

## Current State Analysis

The package under `packages/nextcloud/` is still starter-shaped: name is already `n8n-nodes-nextcloud`, but `description`, `author`, and `repository` are empty or placeholders. Registered nodes are only `Example` and `GithubIssues` with matching credentials. README documents `npm run dev` only; it does not document `npm link` into `~/.n8n/custom`. Toolkit `test_loop.sh` runs lint (and optional `dev:check`) and reminds about manual local n8n — it does not automate the link path. CI already builds/publishes via GitHub Actions; this change does not alter release.

### Key Discoveries:

- Package name is correct for linking: `n8n-nodes-nextcloud` in `package.json`
- Canary display names: search for `Example` / Github Issues node names — not the package name (per n8n docs)
- Official gate steps: global `n8n` → `npm run build` + `npm link` in package dir → `npm link n8n-nodes-nextcloud` in `~/.n8n/custom` (create dir + `npm init` if missing) → `n8n start`
- Starter note: `@n8n/node-cli` bundles n8n for `npm run dev`, so day-to-day does not require a global install — the gate path still does
- Git identity available for author fill: `kacpergolasz` / `kgolasz@outlook.com`; remote `https://github.com/kacpergolasz/n8n-nodes-monorepo.git`

## Desired End State

A contributor (or agent) can follow the README to verify the package locally: identity fields are non-empty and accurate enough for a real community package; both run modes are documented; `npm run build` and `npm run lint` succeed; after the official link path, searching the n8n node panel for `Example` (and optionally Github Issues) finds the canary nodes from this package.

### Key Discoveries:

- F-01 unlocks S-01; do not build Nextcloud Calendar or strip starter nodes in this change
- npm publish remains Secondary / parked — out of scope here

## What We're NOT Doing

- Implementing Nextcloud credentials or suite nodes (S-01+)
- Removing or renaming Example / GithubIssues canaries
- Full product README rewrite from `README_TEMPLATE.md`
- Automating the browser panel check or adding a `dev:check` script
- Changing CI/publish workflows
- Publishing to npm
- Installing or configuring a Nextcloud server

## Implementation Approach

Three thin phases: (1) fill minimal `package.json` identity without touching node registration; (2) add a README section that makes the official link path the documented gate and keeps `npm run dev` as the day-to-day loop, citing n8n docs; (3) run automated build/lint and manually confirm canaries load via the link path. Prefer editing the existing “Develop and Test Locally” area over inventing a parallel doc tree.

## Phase 1: Minimal package identity

### Overview

Make `package.json` a credible community-node package identity so link/audit surfaces are not empty stubs.

### Changes Required:

#### 1. Package metadata

**File**: `package.json`

**Intent**: Fill empty/placeholder identity fields so the package is recognizable as the Nextcloud community node work-in-progress without changing `n8n.nodes` / `n8n.credentials` registrations.

**Contract**: Set non-empty `description` (Nextcloud suite community nodes for n8n — WIP), `author.name` / `author.email` from the known git identity (`kacpergolasz` / `kgolasz@outlook.com`), `repository.url` to the monorepo remote (`https://github.com/kacpergolasz/n8n-nodes-monorepo.git`), and a sensible `homepage` (same repo URL or package path). Leave `name`, scripts, and `n8n.*` arrays unchanged.

### Success Criteria:

#### Automated Verification:

- `package.json` has non-empty `description`, `author.name`, `author.email`, and a non-placeholder `repository.url`
- `n8n.nodes` still lists Example and GithubIssues only
- `npm run build` still succeeds after the metadata edit

#### Manual Verification:

- Identity values look correct to the package owner (no leftover `<...>` placeholders)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: README dual-path local verify

### Overview

Document both local run modes so FR-003’s community-node path is the explicit gate and `npm run dev` remains the fast loop.

### Changes Required:

#### 1. Local testing documentation

**File**: `README.md`

**Intent**: Replace or extend the current “Develop and Test Locally” guidance so the official npm-link path is the verification gate, with `npm run dev` documented as day-to-day, including troubleshooting for missing `~/.n8n/custom`.

**Contract**: Section must cover, in order a contributor can follow:
1. Day-to-day: `npm run dev` (watch build + bundled n8n).
2. Verification gate (required for F-01): steps aligned with [Run your node locally](https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally) — install n8n globally if needed; in package dir `npm run build` then `npm link`; in `~/.n8n/custom` (Linux: `/home/<user>/.n8n/custom`) run `npm link n8n-nodes-nextcloud`; if `custom` missing, `mkdir` + `npm init`; `n8n start`; open the UI and search by **node** name (`Example`), not package name.
3. Link to the official docs page above.
4. Optional one-line note that `N8N_CUSTOM_EXTENSIONS` overrides the custom directory if set.

Do not rewrite the entire README into the product template yet.

### Success Criteria:

#### Automated Verification:

- `README.md` contains both `npm run dev` and `npm link` / `.n8n/custom` guidance
- `README.md` links to the official run-your-node-locally docs URL

#### Manual Verification:

- A cold reader can follow the gate steps without opening this plan
- Canary search hint (`Example`) is explicit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Prove the gate

### Overview

Execute the automated checks and the official link-path manual confirmation so F-01 is demonstrably done.

### Changes Required:

#### 1. Automated package checks

**File**: (no source change required unless build/lint failures force fixes)

**Intent**: Confirm the package builds and lints cleanly after Phases 1–2.

**Contract**: From `packages/nextcloud/`, `npm run build` and `npm run lint` exit 0. Optional: run toolkit `test_loop.sh` for the same lint reminder — not required if `npm run lint` already passes.

#### 2. Manual link-path panel check

**File**: (environment / local n8n — no repo file required)

**Intent**: Prove the community-node install path loads this package’s canaries into the node panel.

**Contract**: Follow README gate steps exactly. After `n8n start`, search the nodes panel for `Example` (and optionally Github Issues). Nodes from this package must appear. No need to execute a GithubIssues workflow against a real GitHub credential.

### Success Criteria:

#### Automated Verification:

- `npm run build` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- After official link path, `Example` is visible in the n8n node panel when searching by node name
- No reliance on `npm run dev` alone for this phase’s pass criteria

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None required for this foundation (no new node logic)

### Integration Tests:

- None automated for panel load; link path is manual by design

### Manual Testing Steps:

1. From `packages/nextcloud/`: `npm run build` then `npm link`
2. Ensure `~/.n8n/custom` exists (`mkdir` + `npm init` if needed); `npm link n8n-nodes-nextcloud`
3. `n8n start` (global install if missing: `npm install n8n -g`)
4. In the UI, search `Example` — confirm the canary node appears
5. Optionally confirm `npm run dev` still starts for day-to-day work (not a gate failure if skipped)

## Performance Considerations

None. Local verify only.

## Migration Notes

If an older link to a previous package name exists under `~/.n8n/custom`, unlink/relink `n8n-nodes-nextcloud` so the panel loads this package. No data migration.

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- PRD FR-003: `context/foundation/prd.md`
- Official docs: https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally
- Toolkit reminder: `.cursor/skills/n8n-node-toolkit/scripts/test_loop.sh`
- Canary: `nodes/Example/Example.node.ts` (`displayName: Example`, `name: example`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Minimal package identity

#### Automated

- [x] 1.1 package.json has non-empty description, author.name, author.email, and a non-placeholder repository.url — a17a1e3
- [x] 1.2 n8n.nodes still lists Example and GithubIssues only — a17a1e3
- [x] 1.3 npm run build still succeeds after the metadata edit — a17a1e3

#### Manual

- [x] 1.4 Identity values look correct to the package owner (no leftover placeholders) — a17a1e3

### Phase 2: README dual-path local verify

#### Automated

- [x] 2.1 README.md contains both npm run dev and npm link / .n8n/custom guidance — 6f98e4e
- [x] 2.2 README.md links to the official run-your-node-locally docs URL — 6f98e4e

#### Manual

- [x] 2.3 A cold reader can follow the gate steps without opening this plan — 6f98e4e
- [x] 2.4 Canary search hint (Example) is explicit — 6f98e4e

### Phase 3: Prove the gate

#### Automated

- [x] 3.1 npm run build exits 0
- [x] 3.2 npm run lint exits 0

#### Manual

- [x] 3.3 After official link path, Example is visible in the n8n node panel when searching by node name
- [x] 3.4 No reliance on npm run dev alone for this phase’s pass criteria
