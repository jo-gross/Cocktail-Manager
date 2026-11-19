# Instance API

Interface of an app instance for the hosted control plane (backoffice, customer portal, worker). The contract lives
in the control plane repository (`contracts/instance-api.openapi.yaml`); the app documents the same operations in
`openapi/openapi.json` (tags `Instance / …`).

Self-hosted instances are not affected: the routes only answer the instance master key, and without
`INSTANCE_MASTER_API_KEY` every call gets `401`.

## Authentication and scope

- Only the instance master key (`Authorization: Bearer <INSTANCE_MASTER_API_KEY>`) is accepted. Sessions, workspace
  API keys and wrong keys get `401 UNAUTHORIZED` (`auth: 'master'` in the `ResourceApiDoc`).
- The routes are **instance-wide by design**: they list and read every workspace and user of the instance. They have
  no `{workspaceId}` scope, so tenant isolation does not apply. No workspace route changed behaviour.
- `X-CM-Actor` (email of the acting administrator) is accepted on every call. Reads do not store it. Writes of later
  stages put `X-CM-Actor` and `X-CM-Reason` into the app audit log and honour `Idempotency-Key`
  (`lib/instance/controlPlaneHeaders.ts` parses and bounds these headers).

## Capabilities

`GET /api/v1/instance` reports the capabilities this build serves (`INSTANCE_CAPABILITIES` in
`lib/instance/config.ts`). The control plane only calls operations whose capability is listed.

| Capability | Operations | Status |
| --- | --- | --- |
| `instance.read` | `GET /api/v1/instance`, `GET /api/v1/instance/workspaces`, `GET /api/v1/instance/workspaces/{id}`, `GET /api/v1/instance/users` | served |
| `entitlements` | `PUT /api/v1/instance/entitlements/default`, `PUT /api/v1/instance/workspaces/{id}/entitlements` | not yet |
| `announcements` | `PUT /api/v1/instance/announcements` | not yet |
| `support.write` | `POST …/transfer-ownership`, `DELETE /api/v1/instance/users/{id}/sessions`, `DELETE /api/v1/instance/workspaces/{id}` | not yet |

`entitlementsMode` comes from `ENTITLEMENTS_MODE` (`off` default, `managed`; see [ENV.md](ENV.md)).

## Operations

### `GET /api/v1/instance`

`apiVersion` (`"1"`), `appVersion` (package version), `commit` (`GIT_SHA` or `null`), `capabilities`,
`entitlementsMode`, `migrationsReady` (same checks as `/api/health/ready`), `chromiumAvailable` (`CHROMIUM_HOST` is set)
and `counts` (`workspaces`: as listed by the inventory; `users`: all users).

### `GET /api/v1/instance/workspaces`

The workspace inventory, `{ data, pagination: { nextCursor } }`.

- **Which workspaces:** every workspace except template workspaces (instance content from `templates/` or marked by
  the template admin) and demo workspaces (throw-away, `DEMO_MODE`). `GET /api/v1/instance/workspaces/{id}` still
  serves both.
- **Paging:** ordered by workspace id. `limit` 1–200 (default 50). `cursor` is opaque (the id of the last item,
  encoded); a cursor stays valid when workspaces are created or deleted. Invalid `cursor`, `limit` or `updatedSince` →
  `400 VALIDATION_ERROR`.
- **`q`:** case-insensitive substring of the workspace name or of an owner's email.
- **`updatedSince`:** ISO 8601 timestamp; only workspaces with `updatedAt >= updatedSince`. See below.
- **Per item:** `createdAt`, `updatedAt`, `owner` (the longest-registered owner, `null` without owner),
  `memberCount`, `lastActivityAt` (newest audit log entry or member visit, `null` if neither exists), `usage` and
  `entitlement` (`null` until the `entitlements` capability exists).

Owner, member count, activity and usage are computed per page with a fixed number of grouped queries
(`lib/api/controllers/instance.ts`, mapping in `lib/instance/usage.ts`).

### `GET /api/v1/instance/workspaces/{id}`

The summary plus `members` (user id, email, name, role, `lastOpened`; owners first), `template` (`{ key }` if the
workspace itself is a template workspace, otherwise `null`; the app does not record which template a workspace was
created from) and `pendingJoinRequests`. Unknown id → `404 NOT_FOUND`.

### `GET /api/v1/instance/users?q=`

Users whose email or name contains `q` (case-insensitive), ordered by email, at most 50. Without `q` the first 50 by
email. Per user: `createdAt`, `providers` (login providers such as `google`, `custom_oidc`, `credential`),
`workspaces` (id, name, role) and `activeSessions` (sessions that have not expired).

Missing emails or names are returned as empty strings (the contract requires strings).

## Usage counts

| Field | Definition |
| --- | --- |
| `cocktails` | cocktails that are not archived |
| `members` | workspace members |
| `calculations` | all calculations |
| `guestMenusPublished` | guest menus with a published version |
| `signageScreens` | configured monitor formats (landscape and portrait, at most 2) |
| `apiKeys` | workspace API keys that are neither revoked nor expired |

The first four match what the control plane derives from the legacy routes (`/cocktails` without archived ones,
`/users`, `/calculations`, `/guest-menus` with `isPublished`).

## `updatedAt` and `updatedSince`

`Workspace.updatedAt` is the time of the last change of something the control plane mirrors:

- the workspace row itself (name, description, image, slug, setup state, …),
- members joining or leaving and role changes,
- name or email of a member,
- workspace settings,
- setting or removing the template mark.

Database triggers maintain it (migration `20261119004919_workspace_timestamps`), so every write path is covered:
controllers, imports, OIDC group sync, cascades and raw SQL. Not covered on purpose: content (cocktails, menus, …),
`lastOpened` visits and template metadata. Usage therefore needs a full sync now and then; `updatedSince` is for the
mirrored workspace data.

The timestamp is the start time of the writing transaction (UTC). A transaction that runs while the control plane
syncs can commit with a timestamp just before the sync started, so incremental syncs should overlap: use the start
time of the previous sync minus a safety margin (e.g. one minute) as `updatedSince`.

The migration back-fills `createdAt` from the oldest audit log entry of the workspace, otherwise the migration time;
`updatedAt` starts at the migration time, so the first incremental sync after the upgrade sees every workspace.

## Tests

- `lib/__tests__/api/v1/instance.integration.test.ts`: every operation, paging, `updatedSince` after member and
  setting changes, search, 401 cases.
- `lib/__tests__/api/v1/workspaceTimestampsMigration.integration.test.ts`: the back-fill on a scratch database with
  existing workspaces and the triggers.
- The auth matrix checks every `auth: 'master'` operation (401 without credentials, with a wrong key, a session or a
  workspace API key). The tenant isolation suite only covers `{workspaceId}` routes; instance routes have no tenant.

## Adding operations (later stages)

1. Schema and `ResourceApiDoc` in `lib/schemas/instance.ts` (spread `instanceOperation`; `auth: 'master'`).
2. Controller in `lib/api/controllers/instance.ts`, wiring in `lib/api/v1/instance.ts`, route file under
   `pages/api/v1/instance/`, binding in `test/helpers/handlerBindings.ts`.
3. Writes: parse `parseControlPlaneHeaders(req.headers)`, audit actor and reason, honour `Idempotency-Key`.
4. Add the capability to `INSTANCE_CAPABILITIES` once all of its operations exist.
