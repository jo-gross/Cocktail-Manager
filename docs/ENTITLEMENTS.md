# Entitlements (plans and limits)

Hosted instances enforce the plan limits a control plane pushes. The app knows no prices and no plan logic: it stores
the finished snapshot per workspace and checks writes against it. Self-hosted instances are not affected.

| `ENTITLEMENTS_MODE` | Behaviour |
| --- | --- |
| `off` (default) | Nothing is checked and no plan UI is shown. Pushed snapshots are stored but have no effect. The guards do not touch the database. |
| `managed` | The snapshot of a workspace applies, otherwise the instance default. Until the control plane pushed a snapshot, everything is allowed, so switching is harmless. |

Code: `lib/entitlements/` (pure decisions in `snapshot.ts`, guards in `guards.ts`, storage in `store.ts`), controllers
in `lib/api/controllers/entitlements.ts`, UI in `components/plan/`. See also [Instance API](INSTANCE-API.md) and
[ENV.md](ENV.md).

## Snapshots and pushes

The snapshot is the `SnapshotWire` of the contract (`contracts/instance-api.openapi.yaml` of the control plane):
`version`, `hash`, `planKey`, `planName` (de/en), `status`, `limits` (all six keys, `null` = unlimited), `features`,
`billing` (`portal` or `contact`) and `nextChangeAt`. Validation is forward compatible: every known field is required
and strictly typed (otherwise `400 VALIDATION_ERROR`), while unknown top-level fields and unknown limit keys of a newer
control plane are stripped. The stored `hash` is always the one the control plane sent.

| Operation | Storage |
| --- | --- |
| `PUT /api/v1/instance/entitlements/default` | `InstanceSetting` `entitlements.default`: the snapshot |
| `PUT /api/v1/instance/workspaces/{id}/entitlements` | `WorkspaceEntitlement` (version, hash, snapshot, applied at) and an audit log entry of the workspace |

- **Version rule:** a push is stored only when its `version` is higher than the stored one. Otherwise the answer is
  `200` with `applied: false`. The answer always carries `currentVersion` and `currentHash` of what the app holds now
  (`0`/`null` without a snapshot). Pushes of one workspace (or of the default) are serialized by an advisory lock.
- **Audit and `Idempotency-Key`:** both pushes run through `runControlPlaneWrite` (`lib/instance/controlPlaneWrite.ts`),
  like every control plane write: the change, an `InstanceAuditLog` entry (`entitlements.default` or
  `entitlements.workspace`, actor, reason, version and plan key) and the answer stored per `Idempotency-Key` commit in one
  transaction. A retry with the same key and request gets the stored answer; the same key with another request answers
  `409 IDEMPOTENCY_KEY_REUSED`. Pushes that do not apply (`applied: false`) are audited as well.
- An applied workspace snapshot additionally writes an entry to the audit log of the workspace (`entityType`
  `WorkspaceEntitlement`, action `CREATE`/`UPDATE`, no user, `controlPlane: { actor, reason }`, `changes.from` with the
  previous version, plan and status), like the ownership transfer of the control plane, so the workspace history shows
  plan changes.
- The workspace inventory of the instance API reports the stored snapshot as `entitlement: { version, hash, planKey }`.
- `GET /api/v1/instance` lists the capability `entitlements` only with `ENTITLEMENTS_MODE=managed`, so the control
  plane does not push to an instance that would ignore it (it then marks the pushes as waiting).

## Guards

Every guard answers `402` through the usual error envelope; the details are in `error.issues`:

```json
{ "error": { "code": "PLAN_LIMIT_REACHED", "message": "The plan allows at most 50 (cocktails)", "issues": { "key": "cocktails", "limit": 50, "current": 50 } } }
```

- `PLAN_LIMIT_REACHED`: `{ key, limit, current }`, `current` is the count before the write.
- `PLAN_FEATURE_MISSING`: `{ key: <feature>, limit: null, current: null }`.
- A write is refused only when it would **raise** a count above its limit. A workspace over a limit after a downgrade
  can still edit, archive, delete and export; nothing is ever removed.
- Limits and features apply to every caller of a workspace route, the instance master key included; only the status
  gate (below) lets the master key through.

| Key | Write paths (relative to `/api/v1/workspaces/{workspaceId}` unless noted) | Check |
| --- | --- | --- |
| `cocktails` (not archived) | `POST cocktails`, `POST cocktails/{id}/clone` | +1 before writing |
| | `PUT cocktails/{id}/unarchive` | count before/after in the transaction |
| | `POST cocktails/import/json` (execute), `POST templates/{key}/apply`, `POST admin/backups/import` | count before/after in the transaction; the backup import also refuses early when the backup alone exceeds the limit |
| `members` | `POST /api/v1/workspaces/join` (first member of an empty workspace), `POST join-requests/{userId}/accept` | +1 before writing |
| `calculations` | `POST calculations` | +1 before writing |
| | `POST calculations/import/json` (execute) | +new (not overwritten) calculations before writing |
| | `POST admin/backups/import`, `POST templates/{key}/apply` | count before/after |
| `guestMenusPublished` | `POST guest-menus/{menuId}/publish` (republishing does not raise the count), backup import, template apply | count before/after |
| `signage` (feature) | every write under `admin/signage/**` (settings, key, slides, guest menu slides); `GET /api/signage/{id}` answers 402 and the monitor page shows "plan required" | feature |
| `signageScreens` | `PUT admin/signage`, `POST admin/signage/slides`, `POST admin/signage/slides/guest-menu` (a format gets its screen on first use), backup import, template apply | count before/after |
| `api` (feature) | `POST api-keys`; requests with a workspace API key answer `402 PLAN_FEATURE_MISSING` while the plan lacks `api` (keys stay stored and work again with the feature) | feature |
| `apiKeys` (active keys) | `POST api-keys` | +1 before writing |
| `statistics.advanced` (feature) | every operation under `statistics/advanced/**` (reads and saved sets); the basic statistics stay open | feature |
| `branding.remove` (feature) | no refusal: without it the public menu page (`/m/…`), the guest menu PDF/print HTML and the table tent show "Powered by Cocktail-Manager" | feature |
| `freeWorkspacesPerOwner` | `POST /api/v1/workspaces` | see below |

Not guarded on purpose: `POST /api/admin/workspace` (the control plane), demo workspaces (`DEMO_MODE`), workspaces and
memberships created by the external OIDC group sync (the identity provider decides), and the `BASE` template every new
workspace gets. Duplicating a guest menu creates an unpublished menu and is therefore free.

### Races

Limit guards run inside the transaction of the write and take a transaction-scoped advisory lock per workspace and key
(`entitlements:<key>`) before counting, so parallel writes of one key are serialized and cannot overshoot. The guard
lock is taken before any other workspace lock of the transaction, except where the write already serializes on its own
lock (joining an empty workspace: `membership`; accepting a join request: the request row); no path takes these locks
in the opposite order, so they cannot deadlock. `freeWorkspacesPerOwner` locks per user. The feature checks need no
lock.

### `freeWorkspacesPerOwner`

The wire snapshot has no field for it (its `limits` hold the six workspace keys only), so the app reads the instance
value from `ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER`. It applies only in `managed` mode and after a default was pushed.
A workspace counts as free when the user owns it and it runs on the default plan: no own snapshot, or one with the
`planKey` of the default. Template and demo workspaces do not count. The limit refuses with
`402 PLAN_LIMIT_REACHED` and `key: "freeWorkspacesPerOwner"`.

## Status

Checked centrally in `withWorkspacePermission` and `withWorkspaceSession` after authentication, for sessions and
workspace API keys. The instance master key (operator access of the control plane) is not checked.

| Status | Rule |
| --- | --- |
| `ACTIVE` | normal |
| `GRACE` | normal, plus a warning banner |
| `READ_ONLY` | `GET`/`HEAD`/`OPTIONS` only; other methods answer `402 WORKSPACE_READ_ONLY`. Exceptions: exports, leaving, deleting the workspace, the portal handoff |
| `SUSPENDED` | every request answers `402 WORKSPACE_SUSPENDED`, reads included. Exceptions: the status view (`GET` workspace, `GET entitlement`), exports, leaving, deleting the workspace |

Exempt routes wrap their handler with `withStatusExemption` (`lib/entitlements/statusGate.ts`):

| Route | `READ_ONLY` | `SUSPENDED` |
| --- | :-: | :-: |
| Exports: `admin/backups/export`, `cocktails/export/json`, `cocktails/export/pdf`, `calculations/export/json`, `glasses/export/json`, `garnishes/export/json`, `ingredients/export/json`, `guest-menus/{menuId}/export/{pdf,html,table-tent.pdf}` | ✓ | ✓ |
| `POST leave`, `DELETE /api/v1/workspaces/{workspaceId}` | ✓ | ✓ |
| `GET /api/v1/workspaces/{workspaceId}`, `GET entitlement` | (reads) | ✓ |
| Portal handoff (task A3): wrap with `HANDOFF_STATUS_EXEMPTION`, so a customer can pay | ✓ | ✓ |

Public pages: with `SUSPENDED` the guest menu page `/m/…` shows a neutral "currently not available" page (503), the
public menu JSON `/api/public/menus/…` (also used by signage menu slides and the public `print`/`monitor` outputs) answers
`503 { status: 'unavailable' }`, and the signage feed answers `503 WORKSPACE_UNAVAILABLE`, which the monitor page shows
as "currently not available" (de/en). The authenticated guest menu PDF, print HTML and table tent stay available as
exports. `READ_ONLY` keeps all public pages working.

### OpenAPI

Every workspace operation documents its `402` with the codes it can answer (`lib/entitlements/openapi.ts`, read by the
OpenAPI generator): the limits and features of the guarded write paths, `WORKSPACE_READ_ONLY`/`WORKSPACE_SUSPENDED` unless
the route is exempt, and `PLAN_FEATURE_MISSING` (`api`) for workspace API keys. Not in the OpenAPI document and therefore
documented only here: `POST /api/v1/workspaces`, `POST /api/v1/workspaces/join`, the backup export/import and the
public signage feed.

## Workspace plan for the UI

`GET /api/v1/workspaces/{workspaceId}/entitlement` (any member, API keys need `WORKSPACE_READ`) answers
`{ mode, plan, usage }`. With `off` it is `{ mode: 'off', plan: null, usage: null }` without a database query.

UI (only shown with `managed`, German and English, namespace `plan`):

- `PlanBoundary` (mounted in `_app.tsx`): loads the plan of the current workspace, shows the status banner
  (`PlanStatusBanner`, its own component so the announcement banner can stack next to it), opens the limit dialog and
  replaces the page by a status view while the workspace is suspended (the settings pages *Data* and *Danger zone*
  stay reachable for export, leaving and deleting).
- `PlanCard` on the general settings page: plan name, status, usage against the limits, features and "Abo verwalten"
  (`billing: portal`) or a contact hint (`billing: contact`).
- `PlanLimitDialog`: opens on every 402 of a plan guard that reaches `apiV1Fetch` (`lib/entitlements/planEvents.ts`).
  Raw `fetch` writes report it with `reportPlanErrorResponse`: the cocktail import wizard (validate and execute), the
  JSON import of glasses/garnishes/ingredients/calculations, the backup import and archive/unarchive on the cocktail
  page. Remaining exceptions: exports (exempt from the status gate), public pages and reads through `fetchWithCache` (a
  suspended workspace shows the status view instead).
- "Abo verwalten" (`ManageSubscriptionButton`) calls `openSubscriptionPortal` in
  `lib/entitlements/subscriptionPortal.ts`. Until the portal handoff (A3) exists, it is disabled with a hint; A3
  implements the function and sets `SUBSCRIPTION_PORTAL_AVAILABLE`.

## Tests

- Unit: `lib/entitlements/__tests__/` (effective snapshot, version rule, limit and status decisions, plan events,
  status exemptions, UI components).
- Integration: `lib/__tests__/api/v1/entitlements.integration.test.ts` (pushes, idempotency, validation, auth, every
  guard at the limit boundary, imports, parallel creates, statuses, API keys, `freeWorkspacesPerOwner`, branding,
  `ENTITLEMENTS_MODE=off`).
