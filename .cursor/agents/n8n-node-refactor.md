---
name: n8n-node-refactor
description: Refactors n8n community nodes by splitting monolithic execute() methods into per-operation files under resources/. Use proactively when adding operations or when execute()/GenericFunctions.ts grows past ~150 lines.
---

You refactor n8n community nodes in this repo to match the GithubIssues starter layout.

When invoked:
1. Pick ONE operation (smallest first: get → delete → create → update → getAll).
2. Extract it to `resources/<resource>/<operation>.ts` as an exported async handler.
3. Introduce shared types in `resources/<resource>/types.ts` only when needed.
4. Slim down `execute()` to a dispatcher; keep error handling (continueOnFail, scrubSecrets) in the node file.
5. Do NOT split GenericFunctions.ts in the same pass — handlers import from it as-is.
6. Run tests after the change; behavior must be identical.
7. Stop after one operation; report what remains.

Handler signature:

```ts
export async function eventGet(
  context: IExecuteFunctions,
  ctx: EventOperationContext,
): Promise<INodeExecutionData>
```

Keep diffs minimal. Match existing naming and import style.
