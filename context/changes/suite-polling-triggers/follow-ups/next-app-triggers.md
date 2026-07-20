# Next suite polling triggers — pattern checklist

Reference implementation: **Nextcloud Files Trigger** (`nodes/NextcloudFilesTrigger/`). Use this checklist when adding Calendar, Deck, Talk, or other app triggers so packaging and poll conventions stay consistent.

## Shared conventions (every app trigger)

- **One Trigger class per app** — e.g. `NextcloudCalendarTrigger`, not a single mega-trigger for the whole suite. Register each dist path in `package.json` → `n8n.nodes`.
- **`polling: true`** — do not author `pollTimes`; n8n injects Poll Times UI and owns scheduling (≥1 minute minimum).
- **`async poll(this: IPollFunctions)`** — return `INodeExecutionData[][] | null`; do not call `__emit` directly.
- **Reuse `nodes/shared/pollHelpers.ts`** — `seedLastTimeChecked` / `getLastTimeChecked` for cursor seeding; optional `filterIdsInStaticData` for ID-window dedupe (Salesforce-style) when timestamps are unreliable.
- **First production poll (empty cursor)** — seed `lastTimeChecked` + initial state, return `null` (no history flood on activation).
- **Soft-fail** — if the listing/API throws **after** initialization, scrub secrets (`scrubSecrets`), log at debug, return `null` without advancing cursor/state (Outlook pattern).
- **Pre-initialization errors** — rethrow (activation should fail loudly when credentials/path are wrong).
- **Manual / Test step** (`getMode() === 'manual'`) — return up to **one** sample item matching selected events; throw a scrubbed error if nothing to show (Google Drive pattern).
- **Credential** — shared `nextcloudApi` (Basic Auth); no per-trigger credential types unless a future app truly needs different auth.
- **Tests** — co-located Vitest under `nodes/<Trigger>/test/`; mock HTTP / `IPollFunctions`; no live Nextcloud in CI.

## Files Trigger (shipped — S-07)

| Topic | Implementation |
|-------|----------------|
| Change detection | Depth-1 PROPFIND via `loadDirectoryListing`; snapshot map `path → { etag, lastModified, isFolder }` in static data (`snapshot` key) |
| Create vs update | `classifyDirectoryChanges(previous, current)` — path keys; prefer **etag** compare, fall back to `lastModified` |
| Events | `fileCreated`, `fileUpdated`, `folderCreated`, `folderUpdated` (multiOptions `event`; default: file created + file updated) |
| Depth | **Direct children only** — notice in UI; nested subfolder changes are not detected |
| Output fields | `event`, `path`, `basename`, `isFolder`, `etag`, `lastModified`, plus `href`, `size`, `contentType` |
| Poll entry | `pollDirectory.ts` → `runDirectoryPoll` |

## Follow-up triggers (not in this change)

### Calendar — blocked on S-08

- **Blocker**: CalDAV listing in this package does not yet filter/report by `LAST-MODIFIED`; PROPFIND responses may truncate (S-08).
- **Target pattern**: Google Calendar Trigger — time-window poll + `lastTimeChecked`; event create/update/cancel parameters.
- **Before starting**: finish S-08 (reliable event listing / sync), then add `NextcloudCalendarTrigger` with app-specific classify logic (not directory snapshot).
- **Reuse**: `pollHelpers` cursor seed; soft-fail + manual sample; separate `classify*` module + poll tests.

### Deck — needs timestamps or ID dedupe

- **Gap**: Deck card listings in this package lack reliable modification timestamps.
- **Options**: (a) extend Deck API helpers to expose `lastModified` / `updated` when available; (b) use `filterIdsInStaticData` for create-only “new card id” detection (Notion-trigger style) until timestamps exist.
- **Reuse**: `pollHelpers` for cursor + optional ID window; same trigger shell shape as Files.

### Talk — later (Gmail-like)

- **Gap**: Talk node does not exist in the package yet.
- **Target pattern**: Gmail Trigger — poll messages/rooms, ID-window dedupe via `filterIdsInStaticData`, soft-fail on transient API errors.
- **Depends on**: Talk action node / API surface landing first.

### News and other apps

- Evaluate per app: is there a list endpoint with `lastModified` or stable ids? If neither, defer or scope to create-only with ID dedupe.

## File layout template

```
nodes/Nextcloud<App>Trigger/
  Nextcloud<App>Trigger.node.ts   # description + poll() delegate
  Nextcloud<App>Trigger.node.json
  poll<App>.ts                    # poll orchestration (like pollDirectory.ts)
  classify<App>Changes.ts         # pure create/update logic (if applicable)
  listSearch/                     # folder/calendar/board pickers as needed
  test/
    classify<App>Changes.test.ts
    Nextcloud<App>Trigger.poll.test.ts
```

Shared helpers stay in `nodes/shared/pollHelpers.ts` — do not copy cursor boilerplate into each trigger.

## Related

- Plan: `context/changes/suite-polling-triggers/plan.md`
- Research: `context/changes/suite-polling-triggers/research.md`
- Roadmap: S-07 (Files trigger), S-08 (Calendar listing), FR-009
