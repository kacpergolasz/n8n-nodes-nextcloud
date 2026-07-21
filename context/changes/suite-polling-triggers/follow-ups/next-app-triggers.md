# Next suite polling triggers — pattern checklist

Reference implementations: **Nextcloud Files Trigger** (`nodes/NextcloudFilesTrigger/`, S-07) and **Nextcloud News Trigger** (`nodes/NextcloudNewsTrigger/`, S-06 — second shipped poller). Use this checklist when adding Calendar, Deck, Talk, or other app triggers so packaging and poll conventions stay consistent.

## Shared conventions (every app trigger)

- **One Trigger class per app** — e.g. `NextcloudCalendarTrigger`, not a single mega-trigger for the whole suite. Register each dist path in `package.json` → `n8n.nodes`.
- **`polling: true`** — do not author `pollTimes`; n8n injects Poll Times UI and owns scheduling (≥1 minute minimum).
- **`async poll(this: IPollFunctions)`** — return `INodeExecutionData[][] | null`; do not call `__emit` directly.
- **Reuse `nodes/shared/pollHelpers.ts`** — `seedLastTimeChecked` / `getLastTimeChecked` for cursor seeding; optional `filterIdsInStaticData` for ID-window dedupe (Salesforce-style) when timestamps are unreliable.
- **Reuse `nodes/shared/pollOrchestration.ts`** — lifecycle envelopes shared by Files + News (and future app triggers):
  - `runPollBootstrap` — load credentials/params; rethrow scrubbed `NodeApiError` on failure (activation must fail loudly).
  - `handlePollListingFailure` — after init, soft-fail via policy hook (`silent` → `null`, or `oneShotNotice` → at most one `{ event: 'pollError', message }` per failure window); before init, rethrow. Clear the notice flag with `clearSoftFailNotice` on the next successful listing.
  - `returnManualSampleOrNull` — Test step returns one sample item or `null` (never throw).
- **First production poll (empty cursor)** — seed `lastTimeChecked` + initial state, return `null` (no history flood on activation). App-specific: decide *what* to seed (snapshot, ID window, etc.).
- **Soft-fail** — prefer `handlePollListingFailure` with an explicit policy rather than copying try/catch boilerplate. Prefer `silent` unless the app needs an operator-visible signal (`oneShotNotice`, as News does).
- **Pre-initialization errors** — rethrow (activation should fail loudly when credentials/path are wrong).
- **Manual / Test step** (`getMode() === 'manual'`) — use `returnManualSampleOrNull`; picking *which* sample remains app-specific (e.g. Files event-aware picker vs News newest article).
- **Credential** — shared `nextcloudApi` (Basic Auth); no per-trigger credential types unless a future app truly needs different auth.
- **Tests** — co-located Vitest under `nodes/<Trigger>/test/`; mock HTTP / `IPollFunctions`; no live Nextcloud in CI. Shared orchestration coverage lives in `nodes/shared/test/pollOrchestration.test.ts`.

## Files Trigger (shipped — S-07)

| Topic | Implementation |
|-------|----------------|
| Change detection | Depth-1 PROPFIND via `loadDirectoryListing`; snapshot map `path → { etag, lastModified, isFolder }` in static data (`snapshot` key); `watchedFolder` stores the seeded path |
| Create vs update | `classifyDirectoryChanges(previous, current)` — path keys; prefer **etag** compare, fall back to `lastModified` |
| Events | `fileCreated`, `fileUpdated`, `folderCreated`, `folderUpdated` (multiOptions `event`; default: file created + file updated) |
| Depth | **Direct children only** — notice in UI; nested subfolder changes are not detected |
| Output fields | `event`, `path`, `basename`, `isFolder`, `etag`, `lastModified`, plus `href`, `size`, `contentType` |
| Soft-fail | `handlePollListingFailure` with `mode: 'silent'` — scrub + debug-log; return `null`; do not advance snapshot |
| Poll entry | `pollDirectory.ts` → `runDirectoryPoll` (lifecycle via `pollOrchestration`) |
| Empty listing guard | After init, a successful `[]` listing keeps the prior snapshot (avoids create-flood); app-specific — not part of shared soft-fail |
| Init gate | Initialized only when **all** of `lastTimeChecked`, `snapshot`, and `watchedFolder` are present and `watchedFolder` matches the current `folderToWatch`. First poll (or folder change / missing piece) re-seeds cursor + snapshot + watched path and returns `null` (no history flood). |

### Files Trigger — deferred follow-ups

- **Large folders**: Poll Depth-1 listing has no entry cap (folder listSearch uses `LIST_SEARCH_MAX_ENTRIES`). Very large directories mean large PROPFIND responses and large static-data snapshots. Add a max-entries warn/cap or document folder-size guidance in a later change — out of scope for S-07.

## Follow-up triggers (not in this change)

### Calendar — blocked on S-08

- **Blocker**: CalDAV listing in this package does not yet filter/report by `LAST-MODIFIED`; PROPFIND responses may truncate (S-08).
- **Target pattern**: Google Calendar Trigger — time-window poll + `lastTimeChecked`; event create/update/cancel parameters.
- **Before starting**: finish S-08 (reliable event listing / sync), then add `NextcloudCalendarTrigger` with app-specific classify logic (not directory snapshot).
- **Reuse**: `pollHelpers` + `pollOrchestration` (bootstrap, silent soft-fail, manual sample); separate `classify*` module + poll tests.

### Deck — needs timestamps or ID dedupe

- **Gap**: Deck card listings in this package lack reliable modification timestamps.
- **Options**: (a) extend Deck API helpers to expose `lastModified` / `updated` when available; (b) use `filterIdsInStaticData` for create-only “new card id” detection (Notion-trigger style) until timestamps exist.
- **Reuse**: `pollHelpers` for cursor + optional ID window; `pollOrchestration` for lifecycle envelopes; same trigger shell shape as Files.

### Talk — later (Gmail-like)

- **Gap**: Talk node does not exist in the package yet.
- **Target pattern**: Gmail Trigger — poll messages/rooms, ID-window dedupe via `filterIdsInStaticData`, soft-fail on transient API errors.
- **Depends on**: Talk action node / API surface landing first.

## News Trigger (shipped — S-06)

Second suite poller after Files. Prefer this pattern when the app exposes stable item ids but no reliable “since” timestamp for create detection.

| Topic | Implementation |
|-------|----------------|
| Change detection | `GET /items` with scope (`type`/`id` from optional folder/feed); ID-window via `filterIdsInStaticData` on article `id` strings |
| Events | New articles only (no delete / update detection in MVP) |
| Filters | Optional folder locator, optional feed locator (feed wins), boolean **Unread only** (`getRead=false` when checked; default **true**) |
| Output | One n8n item per new article — full News article JSON |
| Soft-fail | `handlePollListingFailure` with `mode: 'oneShotNotice'` — scrub + debug-log; emit **at most one** notice item (`event: 'pollError'`) per failure window; do not advance ID window; `clearSoftFailNotice` on next successful poll |
| Init / scope gate | First production poll (or folder/feed filter change) **pages** to seed processed ids (not only newest page) and returns `null` (no history flood) |
| Steady catch-up | Node params `pageSize` (default **100**) and `maxPagesPerPoll` (default **5**). Newest→older walk toward `maxProcessedId` until id ≤ watermark, empty/exhausted list, or page cap. Cap persists `catchUpOffset` (resume survives soft-fail); raise watermark only after catch-up completes. Ring buffer dedupes only — it does not end catch-up. Emit new ids ascending. |
| Poll entry | `pollNews.ts` → `runNewsPoll` (lifecycle via `pollOrchestration`) |
| Docs | https://nextcloud.github.io/news/api/api-v1-3/ |

### Other apps

- Evaluate per app: is there a list endpoint with `lastModified` or stable ids? If neither, defer or scope to create-only with ID dedupe. News is the reference for ID-window + optional unread/scope filters.

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

Shared helpers stay in `nodes/shared/pollHelpers.ts` (cursor / ID window) and `nodes/shared/pollOrchestration.ts` (bootstrap, soft-fail policy, manual sample) — do not copy lifecycle boilerplate into each trigger. Fetch/classify/state remain app-local.

## Related

- Plan: `context/changes/suite-polling-triggers/plan.md`
- Research: `context/changes/suite-polling-triggers/research.md`
- Roadmap: S-06 (News actions + trigger), S-07 (Files trigger), S-08 (Calendar listing), FR-009
