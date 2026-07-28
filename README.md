![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-nextcloud-complete

Automate Nextcloud from n8n with Google-style suite nodes — shared credentials, per-app resources, and list-or-type pickers.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Credentials](#credentials)  
[Applications](#applications)  
[Compatibility](#compatibility)  
[Resources](#resources)  
[License](#license)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

In your n8n instance go to **Settings → Community Nodes → Install** and enter:

```
n8n-nodes-nextcloud-complete
```

## Credentials

One shared credential works across all suite nodes. Create either (or both):

| Credential | Auth | Notes |
| --- | --- | --- |
| **Nextcloud API** | Basic Auth (`baseUrl` / `username` / `appPassword`) | Default path; use a Nextcloud app password |
| **Nextcloud OAuth2 API** | OAuth2 (`baseUrl` / `username` / client id & secret) | Confidential client; Nextcloud grants full account access (no scopes) |

On nodes that support both modes, set **Authentication** to **Basic Auth** or **OAuth2** and attach the matching credential. Resource fields support **From List** and **By ID**.

### OAuth2 setup

1. In Nextcloud, open **Administration settings → Security** and create an OAuth2 client.
2. Copy n8n's **OAuth Redirect URL** from the credential form into the Nextcloud client's redirect URI.
3. In n8n, create a **Nextcloud OAuth2 API** credential with base URL, username, client id, and client secret.
4. Complete the OAuth consent flow in n8n.

> [!WARNING]
> **OAuth2 end-to-end flow untested.** The credential type and Calendar wiring load correctly in n8n, but live OAuth2 consent and operations under OAuth2 have not been verified against a real Nextcloud instance. If you have OAuth2 enabled, please report results or open an issue.

## Applications

`[X]` available · `[]` planned. Fully planned apps are marked `(planned)` in the header only.

### Calendar

CalDAV events with calendar list-or-type pickers.

**Event**
- [X] Create
- [X] Get
- [X] Get Many
- [X] Update
- [X] Delete

**Trigger**
- [] Event created / updated (polling)

### Files

WebDAV files/folders and OCS shares.

**File**
- [X] Upload
- [X] Download
- [X] Delete
- [X] Move
- [X] Copy

**Folder**
- [X] Create
- [X] List
- [X] Delete
- [X] Move
- [X] Copy

**Share**
- [X] Create
- [X] Get Many
- [X] Update
- [X] Delete

**Trigger**
- [X] File / folder created or updated (polling, Depth 1)

### Deck

Boards, stacks, and cards.

**Board**
- [X] Create
- [X] Get
- [X] Get Many
- [X] Update
- [X] Delete

**Stack**
- [X] Create
- [X] Get Many
- [] Update
- [] Delete

**Card**
- [X] Create
- [X] Get
- [X] Get Many
- [X] Update
- [X] Move
- [X] Delete

**Trigger**
- [] Card / board changed (polling)

### News

Nextcloud News API v1.3 (feeds, folders, items).

**Feed**
- [X] Create
- [X] Get Many
- [X] Rename
- [X] Move
- [X] Mark Read
- [X] Get Favicon
- [X] Delete

**Folder**
- [X] Create
- [X] Get Many
- [X] Rename
- [X] Delete

**Item**
- [X] Get Many
- [X] Mark Read / Unread
- [X] Mark Read / Unread Many
- [X] Star / Unstar
- [X] Star / Unstar Many

**Trigger**
- [X] New article (polling)

### Talk (planned)

Conversations, messages, participants, and message triggers (Talk / Spreed API).

### Tasks (planned)

Task lists, tasks, and task triggers (CalDAV / Tasks app).

### Contacts (planned)

Address books, contacts, and contact triggers (CardDAV).

## Compatibility

- **n8n:** community nodes via local link or npm install (see [Run your node locally](https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally))
- **Node.js:** v22 or higher (development)
- **Nextcloud:** self-hosted instances; minimum version TBD
- **Runtime:** `zod` must resolve from the n8n host (declared as a `devDependency` only; community-node `n8n.strict` forbids shipping it as a runtime dependency)

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Nextcloud developer documentation](https://docs.nextcloud.com/server/latest/developer_manual/)
- [Nextcloud Talk API](https://nextcloud-talk.readthedocs.io/)
- [n8n Community Forum](https://community.n8n.io/)
- [n8n Creator Portal](https://creators.n8n.io/nodes)

## License

[MIT](./LICENSE.md)
