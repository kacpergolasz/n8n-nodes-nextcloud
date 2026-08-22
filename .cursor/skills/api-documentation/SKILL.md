---
name: api-documentation
description: Bootstrap API documentation for a n8n node under nodes/ before building an API client. Use when starting API client work, when asked to "get documentation" for an API, to init-documentation, or to save OpenAPI/Swagger specs into context/api/documentation. Creates context/api/documentation/ with verbatim sources plus an OpenAPI-structured openapi.md (Info, Servers, Authorization, Endpoints, Entities) and a README index. Takes the target node/API name (e.g. NextcloudDeck) as input.
---

# Init API Documentation

Create the documentation foundation for a node's API client under `nodes/<NodeName>/context/api/documentation/`, following the workflow established for NextcloudDeck. The input is the node/API to document, e.g. `NextcloudDeck` (a `nodes/<NodeName>/` folder) — or a bare API name to locate.

## Output structure

Create all files under `nodes/<NodeName>/context/api/documentation/`:

```
context/api/documentation/
├── README.md      # index of docs: purpose, file table, quick facts
├── openapi.md     # MAIN reference: OpenAPI-structured markdown
├── <source>.md    # verbatim official docs (one per source, named after source)
├── <spec>.yaml    # verbatim OpenAPI/Swagger spec, IF one is published
└── <assets>       # diagrams etc. referenced by the docs (e.g. er-diagram.jpg). Save diagrams as mermaid charts.
```

## Steps

1. **Locate output context.** Find context folder in repository. If only an API name was given, resolve it to a folder. Create `context/api/documentation/` inside the  folder (not at package root — each node owns its docs).

2. **Hunt for an official OpenAPI/Swagger spec (YAML or JSON).** Search for `openapi.json`/`openapi.yaml`/`swagger` in the vendor's official repo (check the GitHub tree, not just the README), readthedocs, and API aggregations (e.g. api-evangelist `apis.yml`). Note: Nextcloud-style apps often ship none. If found:
   - Download the raw spec verbatim, save as `<spec>.yaml` (convert JSON→YAML only if a tool is available; otherwise keep JSON).
   - Skip the hand-written `openapi.md` — the spec IS the reference — but still add a README index.

3. **No spec published → gather authoritative sources.** Pick the most canonical docs (official repo `docs/`, readthedocs, developer manual). Download raw sources verbatim and save them untouched:
   - Keep original filenames where sensible (`API.md`, `API-{source}.md`, `structure.md`...).
   - Record source URL and retrieval date in the README.
   - Also fetch referenced assets (ER diagrams, linked API docs) — they are part of the documentation.
   - Strip nothing; verbatim copies are the source of truth for later verification.

4. **Write `openapi.md`.** Restructure the gathered docs into an OpenAPI layout. The vendor docs are prose, not JSON Schema — this file translates them faithfully, never invents fields. Sections, mirroring OpenAPI:
   - **Info** — title, API version(s) + changelog notes, description, source URL + retrieval date.
   - **Servers** — base URLs (often one REST + one OCS-style endpoint); table form.
   - **Security / Authorization** — auth scheme (Basic/header/Bearer/API key), required headers, global response shapes (400/403/304), formats (dates, ETags), limits.
   - **Paths / Endpoints** — grouped by tag; one row per operation: Method | Path | Summary | Parameters (path/query/header) | Request body | Success response. Body params as a table with types and optional markers; include request JSON examples when the source has them.
   - **Components / Entities** — one entity per GET payload found in the docs: full example JSON verbatim, then a field table (Field | Type | Description). Include OCS envelope wrapper where responses are wrapped (e.g. `ocs.meta`/`ocs.data`).
   - **Changelog / Related APIs** — version history and adjacent APIs from the docs.

5. **Write `README.md`** — purpose, file table with links, quick facts (auth, base URLs, entity hierarchy, error codes).

6. **Verify.** Re-read your `openapi.md` against the verbatim sources: every endpoint, parameter, field and response must trace back to a source. Flag (don't fabricate) anything undocumented.

## Conventions

- Keep verbatim files byte-faithful to the source; never "clean up" the official docs.
- Only write `openapi.md` when no real spec exists; when a spec exists, save it and point the README at it.
- Attribution always: source URL + retrieval date in README and openapi.md Info.
- Documentation is read-only input for the client skill — never edit it while building the client; update it in a separate change when the API changes.
- Work is done when the node's `context/api/documentation/` contains the README index, either a spec or `openapi.md` + verbatim sources, and every claim in `openapi.md` is traceable.
- Do not show content of files in final message. Just point a link to README.
