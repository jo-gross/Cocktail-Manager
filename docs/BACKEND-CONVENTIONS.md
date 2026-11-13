# Backend conventions

Rules for API routes, controllers and database access. They exist because each
one was violated somewhere and caused a real bug (cross-workspace writes, silent
import rollbacks, lost updates). New and changed endpoints must follow them; the
review checklist at the end is part of the definition of done.

## Layout

| Layer | Location | Responsibility |
| --- | --- | --- |
| Route file | `pages/api/v1/**` | One-line re-export of a handler (+ `export const config` for body limits). No logic. |
| Wiring | `lib/api/v1/*.ts` | `defineApiHandlers(apiDoc.operations, { GET, POST, … })` → controller calls. Hand-wired only for binary/raw responses. |
| Contract | `lib/schemas/*.ts` | zod schemas + `ResourceApiDoc` (roles, API-key permission, params/query/body, response). Drives validation, typing and `openapi/openapi.json`. |
| Logic | `lib/api/controllers/*.ts` | Business logic, Prisma access, audit logs. Returns DTOs, throws `ApiError`. |

There is only one API surface: `/api/v1`. The unversioned `/api/workspaces/**`
routes were removed.

## Authentication and authorization

- Workspace routes go through `defineApiHandlers` → `withWorkspacePermission(roles, permission)`
  (session, workspace API key or master key) or, for `sessionOnly` specs, `withWorkspaceSession`.
- `roles` is the minimum session role (hierarchy escalates). `permission` is the API-key
  scope. Writes need a write scope (`*_CREATE`/`*_UPDATE`/`*_DELETE`), never a `*_READ` scope.
  `permission: null` is only for endpoints that expose nothing workspace-specific.
- The master key acts as user `MASTER_API_KEY_USER_ID` (no DB row). Use `actorUserId(user.id)`
  for nullable user FKs; reject the master key (403) where a real user is required.

## Tenant isolation (most important rule)

Every id that reaches a query — path **and** body — must be proven to belong to the
caller's workspace before it is read, connected, updated or deleted.

- Path id of the resource: `findFirst({ where: { id, workspaceId } })` → `ApiError(404)`,
  or `assertInWorkspace(tx, 'glass', id, workspace.id)` from `lib/api/scope.ts`.
- Updates/deletes: `where: { id, workspaceId }` (or `updateMany`/`deleteMany` + `count` check).
  Never `workspace: { connect }` in an update.
- Ids in bodies (glassId, ingredientIds, unitId, cocktailIds, existingId/overwriteId in imports, …):
  `assertIdsInWorkspace(tx, workspace.id, { glass: [...], ingredient: [...] })` → 400 `INVALID_REFERENCE`.
- Child rows (steps, items, volumes): only ids that belong to the parent loaded in this request.
- Reads by a related id (ratings by cocktailId, images by glassId) filter through the parent:
  `where: { cocktail: { id, workspaceId } }`.

## Transactions

Use a transaction (`runTx` from `lib/db/tx.ts`, or `prisma.$transaction`) when an operation has

- more than one write,
- a write that depends on a prior read (uniqueness check, `max(order) + 1`, counters,
  "delete children and recreate"),
- an entity write plus its audit log or translation.

A single write or a pure read needs none (exception: consistent multi-table snapshots such as the
backup export use `isolationLevel: 'RepeatableRead'`).

Inside the callback:

- Use only the `tx` client. Helpers that write take a `tx`/`Db` parameter.
- No `res.json`, no e-mails, HTTP calls, cache invalidation or file access — return data and do
  side effects after commit.
- No `Promise.all` on the `tx` client; run statements sequentially.
- Never catch a database error and continue: in Postgres a failed statement aborts the whole
  transaction, the commit becomes a rollback, and a "success" response would be a lie.
- Parse and validate input **before** opening the transaction; keep transactions short.
  Bulk work passes `{ timeout: BULK_TX_TIMEOUT_MS }`.

Concurrency patterns:

| Situation | Pattern |
| --- | --- |
| `order`/`priority` = max + 1, default flags, regenerated rows, JSON blobs | `await lockWorkspaceScope(tx, workspaceId, '<scope>')` first, then read and write |
| Counters / quotas (join codes) | `updateMany({ where: { …, used: … }, data: { used: { increment: 1 } } })` and check `count` |
| Consume one queue item | `DELETE … WHERE id = (SELECT id … ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id` |
| Invariants across rows (≥ 1 owner) | `runTx(fn, { isolationLevel: 'Serializable' })` (retries serialization failures) |

## Imports

All-or-nothing. Validate every item first; on any invalid item or reference, write nothing and
return 400 with per-item issues. Execute in one transaction with `BULK_TX_TIMEOUT_MS`; an error
rolls back everything and is reported as an error, never as success.

## Validation and limits

- Every body/query is validated with zod (via the `ResourceApiDoc`). Hand-wired handlers call
  `schema.safeParse` themselves.
- Bound everything: strings (`max`), arrays (`max`), pagination `limit` (`max(200)` or less),
  amounts, numeric ranges (ratings 1–5).
- Images: `ImageDataUriSchema` (`lib/images/imageSchema.ts`) — raster data URIs only, size-capped.
  Serve images with `decodeStoredImage` + `sendImage` (`lib/images/imageResponse.ts`), which set
  `nosniff` and a sandbox CSP.
- Body size: set `export const config = { api: { bodyParser: { sizeLimit } } }` in the route file
  (re-exported `config` is not picked up by Next.js).
- Outbound requests to user-supplied URLs only via `safeFetch` (`lib/http/safeFetch.ts`).

## Errors

- Throw `ApiError(status, CODE, message, issues?)` from controllers.
- `withValidation`/`withHttpMethods` map Prisma errors (`lib/http/prismaErrors.ts`):
  P2025 → 404, P2002 → 409, P2003 → 409, P2034 → 409; everything else → 500 without details.
- Responses never contain `error.message` of unexpected errors, stack traces or Prisma messages.
- Never log cookies, authorization headers, tokens or access codes.

## Audit log

State-changing operations on workspace content write `createLog(tx, …)` /
`createCocktailRecipeAuditLog(tx, …)` with the same `tx` as the change.

## Review checklist (per endpoint)

1. AuthN wrapper and AuthZ (role **and** API-key scope fit the operation)
2. Tenant scope for every path and body id
3. zod validation with bounded sizes
4. Transaction where needed; side effects after commit; audit in the tx
5. Errors mapped; no internals leaked; 405 for wrong methods
6. Body/rate limits for expensive or public endpoints
7. Output contains no secrets or foreign data
8. Integration test: happy path, cross-workspace access → 404/400 with the foreign row unchanged, role/scope denial
