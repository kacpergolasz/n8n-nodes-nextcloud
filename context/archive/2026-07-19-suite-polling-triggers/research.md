---
date: 2026-07-19T21:19:56+02:00
researcher: kacper
git_commit: 46c5667cf4a92b57f960c34579868c2019636da3
branch: polling-triggers
repository: polling-triggers
topic: "In n8n, is polling shared among apps, or created one by one? Which apps support polling reasonably?"
tags: [research, codebase, n8n, polling, triggers, nodes-base, suite-polling-triggers]
status: complete
last_updated: 2026-07-19
last_updated_by: kacper
n8n_monorepo_path: /home/kacper/Dev/10xdevs/n8n
n8n_monorepo_commit: 3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed
---

# Research: n8n polling — shared runtime vs per-app, and good reference nodes

**Date**: 2026-07-19T21:19:56+02:00
**Researcher**: kacper
**Git Commit**: 46c5667cf4a92b57f960c34579868c2019636da3
**Branch**: polling-triggers
**Repository**: polling-triggers

**n8n core sources**: `/home/kacper/Dev/10xdevs/n8n` @ `3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed` (not vendored in this Nextcloud worktree).

## Research Question

In context of N8N, is polling shared among apps, or we create it one by one? Which apps support polling in reasonable way?

Scope chosen: **core + examples**, all focus areas (architecture, good patterns, Nextcloud suite fit), **detailed**.

## Summary

**Polling is a shared n8n runtime; each app implements only `poll()` (+ cursor/dedupe logic).** Scheduling (`pollTimes` → cron), activation, leader-only ticks, emit → workflow run, and static-data persistence on emit are platform-owned. There is **no** shared “polling toolkit” for API fetch/dedupe — each trigger node writes that itself.

**Node packaging convention matches the Google suite:** one **Trigger node per app** (e.g. `GoogleCalendarTrigger`, `GmailTrigger`), not one mega-trigger for the whole suite. Events within an app are parameters (`event` / `triggerOn`), not separate node types.

**Best reference nodes for Nextcloud suite (S-07 / FR-009):**

| Nextcloud surface | Primary template | Why |
|------------------|------------------|-----|
| Calendar | Google Calendar Trigger | Event create/update/cancel windows + `lastTimeChecked` |
| Files | Microsoft OneDrive Trigger | True delta sync (`deltaLink`); best Files model |
| Files (simpler) | Google Drive Trigger | Query-by-time only; closer to PROPFIND/`getlastmodified` |
| Deck | Notion Trigger | Coarse timestamps + `possibleDuplicates` |
| Talk | Gmail Trigger | Dedup + pending queue; soft-fail on errors |
| Dedup helpers | Salesforce Trigger | `processedIds` + safety rewind |

This package currently has **zero** Trigger nodes; zahidcoder community package also lacks polling. Roadmap S-07 says start after Calendar exists and expand per app — do not wait for full suite coverage.

## Detailed Findings

### 1. Shared runtime (not per-app schedulers)

| Layer | Owner |
|-------|--------|
| Discover poll nodes (`nodeType.poll`) | `Workflow.getPollNodes()` |
| Inject `pollTimes` UI when `polling: true` | `DirectoryLoader` + `commonPollingParameters` |
| Activate + register crons | `ActiveWorkflowTriggers.activatePollTrigger` |
| Cron jobs (leader only) | `ScheduledTaskManager` |
| Call `poll()` / emit / errors | `PollTriggerExecutor` + `TriggersAndPollers` |
| Wire `__emit` → run workflow + save static data | CLI `TriggerExecutionContextFactory` |
| API fetch + dedupe / cursor | **Each node’s `poll()`** |

Nodes must **not** call `setInterval` or own a scheduler for polling. (`Schedule Trigger` is a different path: `trigger()` + `helpers.registerCron`.)

Activation flow (simplified):

```
Activate workflow
  → getPollNodes()
  → activatePollTrigger():
       1. Build PollContext (__emit wired by CLI)
       2. pollTimes → toCronExpression()
       3. executePollTrigger(true)   // activation / “testing” poll
       4. ScheduledTaskManager.register(cron → executePollTrigger())
  → on tick: poll() → if non-null __emit → runWorkflow + saveStaticData
```

Key core files (permalinks @ n8n-io/n8n `3f7258b`):

- [commonPollingParameters](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/core/src/nodes-loader/constants.ts#L7-L21) — default every minute
- [DirectoryLoader injects pollTimes](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/core/src/nodes-loader/directory-loader.ts#L406-L410)
- [ActiveWorkflowTriggers.addAllTriggers](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/core/src/execution-engine/active-workflow-triggers.ts#L100-L126)
- [PollTriggerExecutor](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/core/src/execution-engine/poll-trigger-executor.ts)
- [cron.toCronExpression](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/workflow/src/cron.ts#L52-L71) — 6-field cron, jittered second; min interval ≥ 1 minute

### 2. Per-node contract (what “create one by one” means)

Each polling trigger must:

1. **`description.polling: true`** — loader prepends shared Poll Times UI
2. **`async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null>`** — return items or `null` if nothing new
3. Use **`getWorkflowStaticData('node')`** for cursors (`lastTimeChecked`, ids, delta links)
4. Branch on **`getMode() === 'manual'`** for editor test (sample 1 item, often drop time filters; throw if empty) vs production (`null` if empty)
5. **Do not** call `__emit` / `__emitError` — runtime does after `poll()` returns
6. **Do not** hand-author `pollTimes` in `properties` — injected by loader

Discovery is by **`poll` method presence** (not only the flag).

Minimal shape:

```ts
description: { polling: true, group: ['trigger'], inputs: [], /* … */ },
async poll(this: IPollFunctions) {
  const state = this.getWorkflowStaticData('node');
  // fetch since state.lastTimeChecked; update cursor
  if (!items.length) return null;
  return [this.helpers.returnJsonArray(items)];
}
```

**Suite packaging:** Google-built-ins use **one Trigger class per app**, sharing credentials across action + trigger for that app. Not a single `GoogleTrigger` for Calendar+Drive+Gmail. This aligns with PRD “each Nextcloud application as its own node.”

### 3. Apps / nodes that support polling reasonably

Inventory in `nodes-base` (~16 `polling: true` triggers), including:

Google Calendar / Drive / Gmail / Sheets / Business Profile; Microsoft OneDrive / Outlook; Notion; Salesforce; Airtable; SeaTable; Clockify; Toggl; RSS; Venafi.

#### Pattern tiers

**A. Simple timestamp cursor** (`lastTimeChecked` / `lastItemDate`)

- Google Calendar, Google Drive, Microsoft Outlook, Airtable, SeaTable, Clockify, Toggl, RSS, Venafi
- Fine starters; weak under inclusive boundaries / clock skew without ID dedup

**B. Timestamp + ID deduplication**

- Notion — `possibleDuplicates` for same-minute IDs
- Gmail — `possibleDuplicates` + `pendingMessageIds`; soft-fail without advancing cursor incorrectly
- Salesforce — `processedIds` capped at 10k + 15‑min safety rewind (`getPollStartDate`)

**C. True incremental sync**

- Microsoft OneDrive — Graph **delta** (`LastLink` / `@odata.deltaLink`); create vs update via filesystem timestamps
- Google Sheets — Drive revisions + row index (heavy; less analogous to Nextcloud)

#### Best 8 references (detail)

1. **Google Calendar Trigger** — [GoogleCalendarTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Google/Calendar/GoogleCalendarTrigger.node.ts)  
   Events: created / updated / cancelled / started / ended. State: `lastTimeChecked`. Manual clears time filters + `maxResults=1`. No ID dedup.

2. **Microsoft OneDrive Trigger** — [MicrosoftOneDriveTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Microsoft/OneDrive/MicrosoftOneDriveTrigger.node.ts)  
   Best Files model if Nextcloud exposes sync/delta (WebDAV sync-collection / activity). Resets stale delta on scope change.

3. **Google Drive Trigger** — [GoogleDriveTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Google/Drive/GoogleDriveTrigger.node.ts)  
   Folder/file create/update via time query. No subfolder recursion notice. Simpler Files template.

4. **Gmail Trigger** — [GmailTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Google/Gmail/GmailTrigger.node.ts)  
   Production-grade message polling; namespaces static data by node name in later versions. Best Talk/chat template.

5. **Microsoft Outlook Trigger** — [MicrosoftOutlookTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Microsoft/Outlook/MicrosoftOutlookTrigger.node.ts) + `trigger/GenericFunctions.ts`  
   Clean poll shell vs fetch helper; on error with existing cursor: log and return `null` (safer than OneDrive rethrow).

6. **Notion Trigger** — [NotionTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Notion/NotionTrigger.node.ts)  
   Database page add/update; minute precision + `possibleDuplicates`. Good Deck card template.

7. **Salesforce Trigger** — [SalesforceTrigger.node.ts](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Salesforce/SalesforceTrigger.node.ts) + [GenericFunctions.ts ~565–606](https://github.com/n8n-io/n8n/blob/3f7258b1a4f3abe5378b9d6d664f8a9a5c0a02ed/packages/nodes-base/nodes/Salesforce/GenericFunctions.ts#L565-L606)  
   Best reusable dedup helpers when no delta API.

8. **Google Sheets Trigger** — optional revision-style sync; less relevant unless inventing revision tracking.

**Avoid as primary templates:** Google Business Profile (brittle count-delta), thin Airtable/Clockify patterns alone for production-critical paths.

### 4. Shared helpers across nodes

There is **no** package-level polling toolkit. Useful locals only:

| Helper | Path | Role |
|--------|------|------|
| `commonPollingParameters` | `packages/core/src/nodes-loader/constants.ts` | Injects `pollTimes` |
| `getPollStartDate` / `filterAndManageProcessedItems` | Salesforce `GenericFunctions.ts` | Safety margin + ID dedup |
| `getPollResponse` | Outlook `trigger/GenericFunctions.ts` | Extract fetch from node |
| `microsoftApiRequestAllItemsDelta` | OneDrive `GenericFunctions.ts` | Delta pagination |

In-repo convention (`nodes-base` AGENTS.md / node-dev docs): set `polling: true`, implement `poll`, persist with `getWorkflowStaticData('node')`; cite Gmail Trigger as example.

### 5. Fit for this Nextcloud package (S-07)

From foundation:

- **FR-009** — polling triggers for suite changes; must-have; preferred over webhooks (FR-010 parked for Talk-related nice-to-have)
- **Roadmap S-07** — start once Calendar (S-01) exists; expand as apps land; do not wait for every app
- **PRD shape** — separate app nodes (Google panel mirror), shared credential
- **zahidcoder frame** — community package has no polling; coverage gap is a reason rewrite/greenfield still needed
- **This worktree** — no `*Trigger*` nodes yet

Implied implementation shape for planning:

- `NextcloudCalendarTrigger`, `NextcloudFilesTrigger`, `NextcloudDeckTrigger`, `NextcloudTalkTrigger`, … each with `polling: true` + `poll()`
- Shared credential types already used by action nodes
- Optional small shared helpers **inside this package** (cursor seed, ID-window dedup) — not provided by n8n core
- First ship: Calendar (or first app with a reliable “changed since” API), then expand

### Edge cases (platform)

| Case | Behavior |
|------|----------|
| Manual test | `mode === 'manual'`: one `poll()`, return data; no cron. Nodes usually skip filters / sample 1 |
| Activation poll | Runs before crons; errors fail activation; non-null can `__emit` |
| Empty poll | `null` → no emit, no static-data save via `__emit` |
| Static data | Mutated in `poll()`; persisted on successful `__emit` |
| First poll | Convention: seed cursor to “now” so activation does not flood history |
| Min interval | ≥ 1 minute (platform-enforced) |
| Multi-instance | Only leader registers/fires crons |

## Code References

- `packages/core/src/nodes-loader/constants.ts:7-21` — `commonPollingParameters` (default everyMinute)
- `packages/core/src/nodes-loader/directory-loader.ts:406-410` — inject Poll Times when `polling: true`
- `packages/core/src/execution-engine/active-workflow-triggers.ts:100-126` — activate trigger + poll nodes
- `packages/core/src/execution-engine/poll-trigger-executor.ts` — execute poll, emit, discard superseded
- `packages/workflow/src/cron.ts:52-71` — pollTimes → cron
- `packages/nodes-base/nodes/Google/Calendar/GoogleCalendarTrigger.node.ts` — Calendar reference
- `packages/nodes-base/nodes/Microsoft/OneDrive/MicrosoftOneDriveTrigger.node.ts` — Files delta reference
- `packages/nodes-base/nodes/Google/Drive/GoogleDriveTrigger.node.ts` — Files query reference
- `packages/nodes-base/nodes/Google/Gmail/GmailTrigger.node.ts` — Talk-like reference
- `packages/nodes-base/nodes/Notion/NotionTrigger.node.ts` — Deck-like reference
- `packages/nodes-base/nodes/Salesforce/GenericFunctions.ts:565-606` — dedup helpers

(Paths relative to `/home/kacper/Dev/10xdevs/n8n`; permalinks above use commit `3f7258b`.)

## Architecture Insights

1. **Shared schedule, per-app semantics** — n8n owns *when* to poll; each node owns *what changed*.
2. **One trigger node per app** — matches Google suite and this package’s PRD panel shape.
3. **Quality bar is node-local** — production nodes add dedup / delta / soft-fail; timestamp-only nodes are acceptable MVP but weaker.
4. **No community polling examples** in local starter / zahidcoder clones — copy from `nodes-base` Google/Microsoft/Notion/Salesforce.
5. **Poll ≠ webhook ≠ Schedule Trigger** — distinct engine paths; FR-010 webhooks stay separate later work.

## Historical Context (from prior changes)

- `context/foundation/prd.md` — FR-009 must-have polling; FR-010 webhooks nice-to-have / Talk-coupled
- `context/foundation/roadmap.md` — S-07 expands with apps after S-01; do not wait for full suite
- `context/changes/zahidcoder-adopt-or-rewrite/frame.md` — zahidcoder lacks polling (coverage gap)
- `context/archive/2026-07-18-nextcloud-deck/plan.md` — Deck slice explicitly excluded triggers

## Related Research

- None yet under `context/changes/**/research.md` or `context/archive/**/research.md` for polling.

## Open Questions

1. Which Nextcloud APIs give reliable incremental change detection per app (CalDAV `getctag`/`sync-token`, WebDAV sync, Deck/Talk list filters, News)?
2. First shipping app for S-07 — Calendar-only vs Files if sync-collection is stronger?
3. Should this package extract a tiny shared `pollHelpers.ts` (seed cursor, ID window), or keep helpers per trigger like `nodes-base`?
4. Manual-mode UX: throw “no data” (Google style) vs return empty — pick one convention for the suite?
