---
change_id: nextcloud-deck
title: Nextcloud Deck (boards/cards)
status: implementing
created: 2026-07-18
updated: 2026-07-18
---

## Notes

Roadmap S-04 / FR-005. Add a separate **Nextcloud Deck** suite node that automates Deck boards and cards (stacks as supporting concept for card placement), reusing the shared `nextcloudApi` Basic Auth credential and mirroring the Calendar node's modular layout (`GenericFunctions`, `listSearch/`, `resources/`, `shared/`, scrubbing, Vitest).

Deck exposes a **JSON REST API** at `{baseUrl}/index.php/apps/deck/api/v1.0` requiring the `OCS-APIRequest: true` header — much simpler than Calendar's CalDAV/XML (no XML/ICS parsing). zahidcoder is an endpoint reference only (its Deck coverage was boards-only); do NOT adopt its monolith architecture. Out of scope: OAuth2 (S-02), Talk/Files/News, webhooks, label/user/comment/attachment card ops (follow-up).

Planned non-interactively: complexity assessed MEDIUM; every ⭐ Recommended option adopted by the planner (Source=Plan in plan-brief Key Decisions).
