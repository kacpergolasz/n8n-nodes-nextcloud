---
project: "Nextcloud community node (complete integration)"
version: 1
status: draft
created: 2026-07-18
updated: 2026-07-18
context_type: greenfield
product_type: library
target_scale:
  users: small
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 2
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 11
  quality_check_status: accepted
---

# Shape notes

## Seed (verbatim context)

- Idea / research: `~/Dev/10xdevs/n8n/context/changes/nextcloud-integration` (complete Nextcloud integration plan; not an MVP slice).
- Delivery target: **new community node package** under `packages/nextcloud/` — not updating core n8n / `nodes-base`.
- Starter: `/home/kacper/Dev/n8n/starter` as scaffold base.
- Prior art: working Calendar attempt in `packages/nextcloud backup/calendar`.
- Skills: `.cursor/skills` derived from n8n documentation.
- Explicit: ignore MVP scope-down; plan for the **whole** integration.

## Vision & Problem Statement

n8n has no complete Nextcloud integration. Core only ships a thin/poor file (Drive-like) node; suite apps (Calendar, Deck, Talk, and the rest) are not first-class. Automation builders who want to avoid Google and run on self-hosted Nextcloud cannot automate those workflows without stitching incomplete community packages or staying on Google.

Insight: one coherent, first-party-quality community package beats fragmented community nodes and the weak core file surface. Product UX target: searching "nextcloud" in the n8n node panel should feel like a **mirror of the Google suite** (separate app nodes — Drive, Calendar, Chat/Talk, Contacts, Tasks/Deck, etc. — not one monolith), with shared credentials and resource pickers.

Pain category: missing suite capability **and** friction from the thin core file node.

Reference (Google panel shape to mirror): Sheets, Drive, Gemini, Docs, Calendar, Chat, Ads, Tasks, Slides, BigQuery, Contacts, Analytics — Nextcloud counterparts only where a real NC app exists; Google-only services are out of scope as mirrors.

## User & Persona

**Primary:** Automation builder / n8n workflow author on a self-hosted Nextcloud stack — including the package author as first builder and user. They reach for this when wiring Nextcloud automations in n8n and find Google-class coverage missing or only available via Google.

## Access Control

Access is via n8n credentials against a Nextcloud instance — not a separate app login or role model inside the package.

- **Shared credential:** one Nextcloud credential can be reused across all nodes (Calendar, Talk, Drive/files, Deck, etc.). Workflow authors may still create multiple credentials in n8n and attach them per node as usual.
- **Basic Auth and OAuth2** as separate credential types / FRs at the **same priority** (both must-have); shared across suite nodes.
- Capability is whatever that Nextcloud account is allowed to do; no package-level roles (admin/member/guest).

## Success Criteria

### Primary
- Workflow author creates a shared Nextcloud credential, uses a Nextcloud suite node, and gets useful workflow outputs — repeated across the suite apps (Files/Drive, Calendar, Deck, Talk, News, and the rest of the complete integration). First proven path: Basic Auth + Calendar.

### Secondary
- Package publishes successfully to npm as an installable n8n community node package (after local community-node testing).

### Guardrails
- One shared credential works across all suite nodes (authors may still use multiple credentials if they choose).
- No secrets (passwords, tokens) leak into node outputs, logs, or error messages.

## Functional Requirements

### Credentials & first ship
- FR-001: Workflow author can create a shared Nextcloud Basic Auth credential and use it with Nextcloud Calendar (events) to produce useful workflow outputs. Priority: must-have. First priority (credential is only proven once Calendar exists).
  > Socrates: Counter-argument considered: "Calendar-first locks credential design around CalDAV quirks before Files/Talk prove shared auth." Resolution: stands; Calendar + Basic Auth remains the first shippable proof.
- FR-002: Workflow author can create and use a shared Nextcloud OAuth2 credential across suite nodes. Priority: must-have (same priority as Basic Auth; separate FR).
  > Socrates: Counter-argument considered: "Shipping OAuth later means users never get it." Resolution: raised to must-have at same priority as Basic Auth; kept as its own FR.

### Package
- FR-003: Workflow author can build and run the package locally in n8n (community-node local link / run-your-node-locally) and later publish to npm. Priority: must-have for local runnable package; npm publish remains Secondary success.
  > Socrates: Counter-argument considered: "npm publish as must-have delays the suite." Resolution: verify via n8n local community-node testing first (https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally); npm publish stays Secondary.

### Suite nodes
- FR-004: Workflow author can automate Nextcloud Files/Drive at legacy-standard coverage (core-like file/folder/share-style ops, not Drive v2 parity stretch). Priority: must-have
  > Socrates: Counter-argument considered: "Rebuilding Files duplicates core Nextcloud." Resolution: kept; rebuild in community package at legacy standard because core is poor.
- FR-005: Workflow author can automate Nextcloud Deck (boards/cards). Priority: must-have
  > Socrates: Counter-argument considered: "Deck demand is weak; drop for schedule." Resolution: stands; Deck is important to the author; suite apps can be implemented in parallel.
- FR-006: Workflow author can automate Nextcloud Talk, with webhook trigger support treated as related capability (see FR-010). Priority: must-have
  > Socrates: Counter-argument considered: "Talk without webhooks/HITL is useless vs community Talk." Resolution: keep Talk; relate webhooks (FR-010) to Talk; still parallelizable.
- FR-007: Workflow author can automate Nextcloud Contacts. Priority: nice-to-have
  > Socrates: Counter-argument considered: "Contacts is CardDAV noise; few workflows need it." Resolution: demoted to nice-to-have.
- FR-008: Workflow author can automate Nextcloud News. Priority: must-have
  > Socrates: Counter-argument considered: "News is niche; burns time better spent on Files depth." Resolution: stands; News is important to the author with strong use-case belief.

### Triggers
- FR-009: Workflow author can use polling triggers for suite changes. Priority: must-have (top trigger priority)
  > Socrates: Counter-argument considered: "Polling hammers self-hosted Nextcloud; prefer webhooks." Resolution: polling remains top priority.
- FR-010: Workflow author can use webhook triggers for suite changes, especially related to Talk (FR-006). Priority: nice-to-have relative to polling, but coupled with Talk value
  > Socrates: Counter-argument considered: "Webhooks as nice-to-have abandons community Talk pattern." Resolution: webhooks stay lower than polling overall, but are explicitly related to Talk (FR-006).

### UX across suite nodes
- FR-011: Workflow author can pick remote resources via loaded lists (e.g. existing calendars on Get Events) with a manual-input fallback, using the shared credential. Priority: must-have
  > Socrates: Implied by Google-mirror UX; kept without demotion.

## User Stories

### US-01: Shared credential + Calendar first path

- **Given** a Nextcloud instance and no prior suite nodes configured
- **When** the author creates one shared Basic Auth credential and runs a Calendar node operation
- **Then** they get useful calendar/event workflow outputs, and that same credential is available for later suite nodes

#### Acceptance Criteria
- Calendar path works with Basic Auth before other suite nodes are required
- Credential is reusable across nodes once more apps land
- Secrets do not appear in outputs or error messages
- Package is verifiable via local n8n community-node run before npm publish
- Resource fields support list-from-Nextcloud plus manual input (FR-011)

## Business Logic

A workflow author gets a Google-alternative automation surface in n8n by exposing Nextcloud operations behind one shared credential — with each Nextcloud application as its own node (Google-suite mirror in the node panel).

Inputs: shared Nextcloud credential (Basic Auth and/or OAuth2) plus chosen app node, operation, and resource selection (loaded from Nextcloud or entered manually). Outputs: useful n8n items and/or trigger events. Encounter: search "nextcloud" → pick app node (as with Google Calendar / Drive / Chat / …) → attach credential → list or type resources → execute or trigger.

## Non-Functional Requirements

- No secrets (passwords, tokens) appear in node outputs, logs, or error messages.
- Package is installable and runnable via the local n8n community-node path before npm publish.
- Works against self-hosted Nextcloud instances (exact minimum version TBD if needed).

## Non-Goals

- Avoid: Google-only mirrors with no Nextcloud counterpart (Ads, Analytics, BigQuery, Gemini, Slides, …) — mirror the Google *panel shape* only where a real NC app exists.
- Avoid: replacing or patching core n8n `nodes-base` Nextcloud — this is a community package under `packages/nextcloud/` only.

## Quality cross-check

All soft-gate elements present (Access Control, Business Logic, artifacts, timeline ≤ 3 weeks, Non-Goals). Status: **accepted** on 2026-07-18. No gaps recorded.

## Forward: technical-roadmap
- Local test path: [Run your node locally](https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally) (`npm run build` → `npm link` → link into `~/.n8n/custom` → `n8n start`).
- Parallel implementation of suite nodes is acceptable within the ~2-week delivery window.
- Google panel mirror reference: separate per-app nodes (Drive, Calendar, Chat, Contacts, Tasks, …); Google-only services (Ads, Analytics, BigQuery, Gemini, …) are not forced Nextcloud nodes.