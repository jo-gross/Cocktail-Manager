# Instance API

Interface of an app instance for the hosted control plane (backoffice, customer portal, worker). The contract lives
in the control plane repository (`contracts/instance-api.openapi.yaml`); the app documents the same operations in
`openapi/openapi.json` (tags `Instance / …`).

Self-hosted instances are not affected: the routes only answer the instance master key, and without
`INSTANCE_MASTER_API_KEY` every call gets `401`. Announcements and support writes are only advertised with
`ENTITLEMENTS_MODE=managed`.

## Authentication and scope

- Only the instance master key (`Authorization: Bearer <INSTANCE_MASTER_API_KEY>`) is accepted. Sessions, workspace
  API keys and wrong keys get `401 UNAUTHORIZED` (`auth: 'master'` in the `ResourceApiDoc`).
- The routes are **instance-wide by design**: they list and read every workspace and user of the instance. They have
  no `{workspaceId}` scope, so tenant isolation does not apply. No workspace route changed behaviour.
- `X-CM-Actor` (email of the acting administrator) is accepted on every call. Reads do not store it. Writes put
  `X-CM-Actor` and `X-CM-Reason` into the audit log and honour `Idempotency-Key`, see [Writes](#writes-audit-and-idempotency)
  (`lib/instance/controlPlaneHeaders.ts` parses and bounds these headers).

## Capabilities

`GET /api/v1/instance` reports the capabilities this instance serves (`instanceCapabilities()` in
`lib/instance/config.ts`). The control plane only calls operations whose capability is listed.

`INSTANCE_CAPABILITIES` are advertised in every mode, `MANAGED_INSTANCE_CAPABILITIES` only with
`ENTITLEMENTS_MODE=managed`. The routes themselves do not check the mode: they need the master key, which only the
operator of the instance has.

| Capability | Operations | Status |
| --- | --- | --- |
| `instance.read` | `GET /api/v1/instance`, `GET /api/v1/instance/workspaces`, `GET /api/v1/instance/workspaces/{id}`, `GET /api/v1/instance/users` | served |
| `entitlements` | `PUT /api/v1/instance/entitlements/default`, `PUT /api/v1/instance/workspaces/{id}/entitlements` | served with `ENTITLEMENTS_MODE=managed` ([ENTITLEMENTS.md](ENTITLEMENTS.md)) |
| `announcements` | `PUT /api/v1/instance/announcements` | served in `managed` mode |
| `support.write` | `POST …/transfer-ownership`, `DELETE /api/v1/instance/users/{id}/sessions`, `DELETE /api/v1/instance/workspaces/{id}` | served in `managed` mode |

`entitlementsMode` comes from `ENTITLEMENTS_MODE` (`off` default, `managed`; see [ENV.md](ENV.md)). Capabilities that
only make sense in `managed` mode (`MANAGED_INSTANCE_CAPABILITIES`: `entitlements`, `announcements`, `support.write`) are
reported only then, so an instance in `off` never receives calls it would ignore.

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
  `entitlement` (`{ version, hash, planKey }` of the stored snapshot, `null` if the control plane has not pushed one).

Owner, member count, activity and usage are computed per page with a fixed number of grouped queries
(`lib/api/controllers/instance.ts`, mapping in `lib/instance/usage.ts`).

### `GET /api/v1/instance/workspaces/{id}`

The summary plus `members` (user id, email, name, role, `lastOpened`; owners first), `template` (`{ key }` if the
workspace itself is a template workspace, otherwise `null`; the app does not record which template a workspace was
created from) and `pendingJoinRequests`. Unknown id → `404 NOT_FOUND`.

### `PUT /api/v1/instance/entitlements/default`, `PUT /api/v1/instance/workspaces/{id}/entitlements`

Snapshot pushes with the version rule of the contract (`applied`, `currentVersion`, `currentHash`), forward-compatible
validation (unknown fields stripped), written through `runControlPlaneWrite` (`InstanceAuditLog` with
`X-CM-Actor`/`X-CM-Reason`, `Idempotency-Key`, 409 `IDEMPOTENCY_KEY_REUSED`). Details: [ENTITLEMENTS.md](ENTITLEMENTS.md).

### `GET /api/v1/instance/users?q=`

Users whose email or name contains `q` (case-insensitive), ordered by email, at most 50. Without `q` the first 50 by
email. Per user: `createdAt`, `providers` (login providers such as `google`, `custom_oidc`, `credential`),
`workspaces` (id, name, role) and `activeSessions` (sessions that have not expired).

Missing emails or names are returned as empty strings (the contract requires strings).

### `PUT /api/v1/instance/announcements`

Replaces the full set of announcements; `{ "announcements": [] }` removes all. Answers `{ count }`.

| Field | Rules |
| --- | --- |
| `id` | id in the control plane, unique within the set |
| `level` | `info`, `warning` or `critical`, lowercase; anything else → `400` |
| `title` | optional `{ de, en }`, both required and not empty, at most 200 characters each |
| `body` | required `{ de, en }`, both required and not empty, at most 2000 characters each |
| `startsAt`, `endsAt` | optional ISO 8601 timestamps; `endsAt` must be after `startsAt` |
| `workspaceIds` | targeted workspaces (at most 1000); empty = all workspaces. Unknown ids are stored and match nothing |

At most 50 announcements per set.

**Texts per language:** `title` and `body` are `LocalizedText` objects of the contract. The banner shows `de` to users
with a German UI and `en` to everyone else. A plain string, a missing language or an empty text → `400`; there is no
fallback between the languages. Texts are trimmed.

**In the app:** a banner on the workspace overview (announcements for all workspaces) and inside a workspace (for all
and for this workspace), most severe first, only within the time window (`components/announcements/`). Users can
dismiss `info` announcements; the dismissal is stored in the browser per announcement id and content, so a changed
announcement shows again. `warning` and `critical` stay until the control plane removes them or `endsAt` passes. The
banner reads `GET /api/v1/announcements` and `GET /api/v1/workspaces/{workspaceId}/announcements` (session only, every
member; the workspace read stays open in a suspended workspace) and refreshes every five minutes, only with
`ENTITLEMENTS_MODE=managed`: the browser learns the mode from `GET /api/config/entitlements` and a self-hosted instance
never requests or polls announcements.

### `POST /api/v1/instance/workspaces/{id}/transfer-ownership`

Body `{ userId }`, answers `{ ownerId }`. The user must be a member of the workspace and becomes its only owner; every
other owner becomes `ADMIN`. Unknown workspace, unknown user or a user who is not a member → `404 NOT_FOUND`. The role
changes are written to the audit log of the workspace (entity `WorkspaceUser`, with actor and reason of the control
plane) and run `Serializable`, like the other owner changes.

A workspace with several owners therefore has exactly one owner afterwards. Nobody loses access: the former owners
keep every right except the owner-only ones. Transferring to the member who already is the only owner changes nothing.

### `DELETE /api/v1/instance/users/{id}/sessions`

Deletes every session of the user and answers `{ revoked }`, the number of sessions that had not expired. Unknown user
→ `404 NOT_FOUND`. The account, its memberships and API keys stay. A browser can keep working for up to five minutes
after the call: the session cookie cache of the app (`session.cookieCache` in `lib/auth.ts`) is not invalidated from
the server.

### `DELETE /api/v1/instance/workspaces/{id}`

Deletes the workspace with all of its content, like an owner deleting it, and answers `{ deleted: true }`. Users stay.
Unknown workspace → `404 NOT_FOUND`; a template workspace → `409 TEMPLATE_IN_USE`.

## Writes: audit and idempotency

Every write of the control plane runs through `runControlPlaneWrite` (`lib/instance/controlPlaneWrite.ts`), the shared
helper for all capabilities (announcements, support writes, entitlements): the change, its audit entry and the stored
answer commit in one transaction. It knows nothing about the operation; a caller passes the action name, the target,
the request body and the change.

- **Audit:** one row in `InstanceAuditLog` per applied write: `action` (`announcements.replace`,
  `workspace.transferOwnership`, `user.revokeSessions`, `workspace.delete`, `entitlements.default`, `entitlements.workspace`), target, `actor` (`X-CM-Actor`), `reason`
  (`X-CM-Reason`) and `details` (e.g. name, member count and owners of a deleted workspace, whose own audit log is
  deleted with it). Both headers are optional; the control plane always sends them. Secrets such as session tokens
  are never stored.
- **`Idempotency-Key`** (UUID): a retry with the same key and the same request (operation, target, body) gets the
  first answer and changes nothing, also when the state has changed since. Failed writes (4xx/5xx) store nothing, so a
  retry runs again. Without a key every call is applied.
- **`409`** (contract `components.responses.Conflict`, documented for every write): `IDEMPOTENCY_KEY_REUSED` when the
  key was already used for another request, and conflicting states such as `TEMPLATE_IN_USE`.
- Invalid headers (key that is no UUID, actor over 254 or reason over 500 characters) → `400 VALIDATION_ERROR`.
- **Retention** (`lib/instance/auditRetention.ts`): `InstanceAuditLog` entries are deleted after 90 days. The stored
  answer of an `Idempotency-Key` is kept for 30 days; after that the key is released (cleared, the entry stays as
  audit until it is deleted), and a request with that key runs again. The control plane reuses a key only for retries
  of an open push, which end within hours. The cleanup runs after a control plane write, at most once per hour per
  process, so an instance without control plane writes never runs it.

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
- workspace settings,
- setting or removing the template mark.

Database triggers maintain it (migration `20261119004919_workspace_timestamps`), so every write path is covered:
controllers, imports, OIDC group sync, cascades and raw SQL. Not covered on purpose: content (cocktails, menus, …),
`lastOpened` visits and template metadata. Usage therefore needs a full sync now and then; `updatedSince` is for the
mirrored workspace data.

**`updatedSince` does not cover a member's name or email change.** A trigger on `User` would have to update every
workspace of the user on each rename: 33× slower renames for members of many workspaces and deadlocks with long
imports. The control plane runs a full listing at least daily, so changed member names and emails (owner, member
list) arrive with it.

A transaction that writes many child rows of one workspace (an import, a template) updates the workspace row once: the
triggers skip a workspace whose `updatedAt` already has the transaction's time.

The timestamp is the start time of the writing transaction (UTC, independent of the time zone of the database
session). A transaction that runs while the control plane syncs can commit with a timestamp just before the sync
started, so incremental syncs should overlap: use the start time of the previous sync minus a safety margin (e.g. one
minute) as `updatedSince`.

The migration back-fills `createdAt` from the oldest audit log entry of the workspace, otherwise the migration time;
`updatedAt` starts at the migration time (both UTC), so the first incremental sync after the upgrade sees every
workspace. It also adds the index `AuditLog(workspaceId, createdAt)`, which the inventory uses for `lastActivityAt`
(one index lookup per workspace of a page).

## Tests

- `lib/__tests__/api/v1/instance.integration.test.ts`: every operation, paging, `updatedSince` after member and
  setting changes, search, 401 cases.
- `lib/__tests__/api/v1/workspaceTimestampsMigration.integration.test.ts`: the back-fill on a scratch database with
  existing workspaces (session time zone `Europe/Berlin`, so local time instead of UTC fails), the triggers, no trigger
  on `User` and one row version per transaction.
- `lib/__tests__/api/v1/instanceAnnouncements.integration.test.ts`: the push (replace, validation, 401 cases, audit,
  idempotent retries, concurrent retries), banner targeting (all, listed workspaces, time window) and capabilities
  per mode.
- `lib/__tests__/api/v1/instanceAuditRetention.integration.test.ts`: retention of the audit log and the stored answers.
- `lib/__tests__/api/v1/instanceSupport.integration.test.ts`: ownership transfer, session revocation and workspace
  deletion: effect, unknown ids, validation, 401 cases, audit entries, idempotent retries and reused keys.
- `components/announcements/__tests__/` and `lib/announcements/__tests__/`: banner rendering, texts per language and
  dismissal.
- The auth matrix checks every `auth: 'master'` operation (401 without credentials, with a wrong key, a session or a
  workspace API key). The tenant isolation suite only covers `{workspaceId}` routes; instance routes have no tenant.

## Adding operations (later stages)

1. Schema and `ResourceApiDoc` in `lib/schemas/instance.ts` or a file next to it (spread `instanceOperation`, for
   writes `instanceWriteOperation`; `auth: 'master'`).
2. Controller in `lib/api/controllers/`, wiring in `lib/api/v1/`, route file under `pages/api/v1/instance/`, binding
   in `test/helpers/handlerBindings.ts`.
3. Writes: run the change in `runControlPlaneWrite` (audit entry with actor and reason, `Idempotency-Key`).
4. Add the capability to `INSTANCE_CAPABILITIES` or `MANAGED_INSTANCE_CAPABILITIES` once all of its operations exist.
