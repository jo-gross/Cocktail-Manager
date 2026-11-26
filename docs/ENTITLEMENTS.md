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
`billing` (`portal` or `contact`), `nextChangeAt` and `scheduledEnd`. Validation is forward compatible: every known
field is required and strictly typed (otherwise `400 VALIDATION_ERROR`), while unknown top-level fields and unknown
limit keys of a newer control plane are stripped. The stored `hash` is always the one the control plane sent.

`scheduledEnd` is the only field that may be missing (older control planes); a missing field counts as `null`. When
present it is `null` or `{ at, planKey, planName: { de, en } }`, strictly typed: the subscription was cancelled and
ends at `at`, then the named plan (the instance default plan) applies. It is stored with the snapshot and only
displayed. The app never switches the plan at `at` itself; the control plane pushes the new snapshot when the
subscription has ended.

| Operation | Storage |
| --- | --- |
| `PUT /api/v1/instance/entitlements/default` | `InstanceSetting` `entitlements.default`: the snapshot |
| `PUT /api/v1/instance/workspaces/{id}/entitlements` | `WorkspaceEntitlement` (version, hash, snapshot, applied at) and an audit log entry of the workspace |

- **Version rule:** a push is stored only when its `version` is higher than the stored one. Otherwise the answer is
  `200` with `applied: false`. Exception: a stored snapshot that no longer parses (see *Stored snapshots*) is also
  replaced by a push of the same version. The answer always carries `currentVersion` and `currentHash` of what the app holds now
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
- **Stored snapshots** are read leniently (`readStoredSnapshot` in `snapshot.ts`): rows are validated on write, but a
  newer app may validate stricter or a row may have been edited. Every valid known field is kept; a field that does not
  parse counts as unrestricted (limit `null`, status `ACTIVE`, the known features, `billing: contact`), like a workspace
  before its first push. A workspace with an unreadable snapshot therefore never falls back to the (free) instance
  default. The app logs this once per process with the field names only, never values; the control plane's next push
  of the same version repairs it.
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
| `SUSPENDED` | every request answers `402 WORKSPACE_SUSPENDED`, reads included. Exceptions: the status view and the reads of the app shell (`GET` workspace, `GET entitlement`, `GET translations`, `GET announcements`), exports, leaving, deleting the workspace, the portal handoff |

Exempt routes wrap their handler with `withStatusExemption` (`lib/entitlements/statusGate.ts`):

| Route | `READ_ONLY` | `SUSPENDED` |
| --- | :-: | :-: |
| Exports: `admin/backups/export`, `cocktails/export/json`, `cocktails/export/pdf`, `calculations/export/json`, `glasses/export/json`, `garnishes/export/json`, `ingredients/export/json`, `guest-menus/{menuId}/export/{pdf,html,table-tent.pdf}` | ✓ | ✓ |
| `POST leave`, `DELETE /api/v1/workspaces/{workspaceId}` | ✓ | ✓ |
| `GET /api/v1/workspaces/{workspaceId}`, `GET entitlement`, `GET translations`, `GET announcements` (read by the app shell on every workspace load) | (reads) | ✓ |
| `POST portal/handoff` (`HANDOFF_STATUS_EXEMPTION`), so a customer can pay | ✓ | ✓ |

Public pages: with `SUSPENDED` the guest menu page `/m/…` shows a neutral "currently not available" page (503), the
public menu JSON `/api/public/menus/…` (also used by signage menu slides and the public `print`/`monitor` outputs) answers
`503 { status: 'unavailable' }`, the public menu images `/api/public/images/…` answer `503 WORKSPACE_UNAVAILABLE` (they
belong to the menu that is unavailable), and the signage feed answers `503 WORKSPACE_UNAVAILABLE`, which the monitor
page shows as "currently not available" (de/en). The monitor page reacts only to these answers of the feed (and to
`402 PLAN_FEATURE_MISSING`); any other failure, e.g. a 503 page of a reverse proxy during a restart, keeps the slides. The authenticated guest menu PDF, print HTML and table tent stay available as
exports. `READ_ONLY` keeps all public pages working.

### OpenAPI

Every workspace operation documents its `402` with the codes it can answer (`lib/entitlements/openapi.ts`, read by the
OpenAPI generator): the limits and features of the guarded write paths, `WORKSPACE_READ_ONLY`/`WORKSPACE_SUSPENDED` unless
the route is exempt, and `PLAN_FEATURE_MISSING` (`api`) for workspace API keys. Not in the OpenAPI document and therefore
documented only here: `POST /api/v1/workspaces`, `POST /api/v1/workspaces/join`, the backup export/import and the
public signage feed.

## Workspace plan for the UI

`GET /api/v1/workspaces/{workspaceId}/entitlement` (any member, API keys need `WORKSPACE_READ`) answers
`{ mode, plan, usage, portalHandoff }`; `plan.scheduledEnd` is the `scheduledEnd` of the snapshot or `null`. With `off` it is `{ mode: 'off', plan: null, usage: null, portalHandoff: false }`
without a database query. `portalHandoff` says whether the instance offers the customer portal (see
[Portal handoff](#portal-handoff)).

UI (only shown with `managed`, German and English, namespace `plan`). The browser reads the mode from
`GET /api/config/entitlements` (public, no database, cached five minutes) once per page load; with `off` it requests
neither the plan nor announcements, so a self-hosted instance makes no request per workspace open beyond v1.22.

- `PlanBoundary` (mounted in `_app.tsx`): loads the plan of the current workspace, shows the status banner
  (`PlanStatusBanner`, its own component so the announcement banner can stack next to it), opens the limit dialog and
  replaces the page by a status view while the workspace is suspended. It renders the same tree in every state, so the
  page is not remounted when the plan loads or the workspace changes. The status view offers every member the export
  they may run today (all cocktails with their glasses, garnishes and ingredients, and all calculations as JSON, via
  `all: true` on `POST cocktails/export/json` and `POST calculations/export/json`) and "Workspace verlassen" (`POST
  leave`; not for the last owner, nor in externally managed workspaces, like the users page). Admins also reach the
  settings pages *Data* (full backup) and *Danger zone*; with `billing: portal` it offers "Abo verwalten".
- `PlanCard` on the general settings page: plan name, status, usage against the limits, features and "Abo verwalten"
  (`billing: portal`) or a contact hint (`billing: contact`). With `scheduledEnd` it shows "Dein Abo endet am … Danach
  gilt …" instead of the generic "Nächste Änderung am …" line of `nextChangeAt`. The end date is shown in
  `Europe/Berlin`, like the mail and the portal of the control plane; `nextChangeAt` stays in the browser's time zone.
  "Abo verwalten" (`intent: manage`) is the button of the card header, or sits next to the text when the header has
  none.
- `PlanLimitDialog`: opens on every 402 of a plan guard that reaches `apiV1Fetch` (`lib/entitlements/planEvents.ts`),
  except reads refused with `WORKSPACE_SUSPENDED` (the page and the shell load in the background before the plan is
  known); those only reload the plan, which then shows the status view.
  Raw `fetch` writes report it with `reportPlanErrorResponse`: the cocktail import wizard (validate and execute), the
  JSON import of glasses/garnishes/ingredients/calculations, the backup import and archive/unarchive on the cocktail
  page. Remaining exceptions: exports (exempt from the status gate), public pages and reads through `fetchWithCache` (a
  suspended workspace shows the status view instead).
- "Abo verwalten" / "Upgrade" (`ManageSubscriptionButton`, only for `billing: portal`): see [Portal handoff](#portal-handoff).

## Portal handoff

An owner clicks "Abo verwalten" or "Upgrade" and lands signed in on the page of this bar in the customer portal of the
hosting provider. The app signs a short-lived token; the portal checks it at `/sso`. The app never calls the control
plane for this. Contract: `contracts/portal-handoff.md` of the control plane (claims, keys, checks, result codes and a
test vector). Code: `lib/portal/` (signer, env), `lib/api/controllers/portalHandoff.ts`,
`lib/entitlements/subscriptionPortal.ts` and `components/plan/ManageSubscriptionButton.tsx`.

**Availability.** Only with `ENTITLEMENTS_MODE=managed`, a valid `PORTAL_HANDOFF_PRIVATE_KEY`, a valid `PORTAL_URL`
and a public URL of the app (`BETTER_AUTH_URL`, else `NEXTAUTH_URL`, else `NEXT_PUBLIC_APP_URL`), see
[ENV.md](ENV.md#customer-portal-abo-verwalten). The plan of the workspace reports it as `portalHandoff`; otherwise the
endpoint answers `404 PORTAL_HANDOFF_UNAVAILABLE`.

**`POST /api/v1/workspaces/{workspaceId}/portal/handoff`**, body `{ intent: 'manage' | 'upgrade', locale?: 'de' | 'en' }`,
answers `{ url: '<PORTAL_URL>/sso?token=…' }` with `Cache-Control: no-store`. The client then navigates there (a
top-level navigation, so the portal can set its cookie). A POST plus client-side navigation keeps the token out of the
access logs of the app.

- **Who:** a signed-in session with role `OWNER` in the workspace (`sessionOnly`: workspace API keys and the master
  key get `401`; lower roles `403`). An unverified or missing email address answers `403 EMAIL_NOT_VERIFIED`, so the UI
  can explain it. Allowed in `READ_ONLY` and `SUSPENDED` (`HANDOFF_STATUS_EXEMPTION`).
- **Token:** compact JWS, `{"alg":"EdDSA","typ":"JWT"}`, Ed25519 with Node's `crypto` (no JWT dependency), signed per
  click. Claims in the order of the contract:

  | Claim | Value |
  | --- | --- |
  | `iss` | origin of the app's public URL, as `new URL(url).origin` spells it (no path, no trailing slash, lowercase host, no default port) |
  | `aud` | `portal` |
  | `sub`, `email`, `name` | user id, email as stored, display name (empty string without one; cut to 200 characters) |
  | `email_verified` | `true` only for the boolean `true` of `User.emailVerified` |
  | `wid`, `wname` | workspace id and name (cut to 200 characters) |
  | `role` | the membership role as is (`OWNER`) |
  | `locale` | `locale` of the request (the UI language), else the user's language setting, else `de` |
  | `intent` | `manage` or `upgrade`; the portal picks the target page (no return URL, no open redirect) |
  | `iat`, `exp` | now and now + 120 s |
  | `jti` | 16 random bytes, base64url (22 characters) |

- **Audit:** one entry in the audit log of the workspace per handoff: `entityType` `PortalHandoff`, action `CREATE`,
  the user, `snapshot: { event: 'portal handoff', intent, locale }`. Neither the token, its `jti` nor the URL are logged
  or stored.
- **Errors of the portal** (`invalid`, `expired`, `replayed`, `unknown_instance`, `workspace_unavailable`, …) land on the
  portal's own `/handoff` page; the app needs nothing for them. `unknown_instance` usually means the public key is not
  registered in the backoffice or the `iss` origin differs from the registered public URL; `invalid` a key mismatch
  (rotation) or a wrong server clock.

**UI** (de/en, only for `billing: portal`): the plan card and the status banner (every status, also `SUSPENDED`) show
"Abo verwalten" (`intent: manage`); the limit dialog shows "Upgrade" (`intent: upgrade`) for limits and features and
"Abo verwalten" for read-only and suspended workspaces; the suspended status view shows "Abo verwalten".

| Situation | Button |
| --- | --- |
| `portalHandoff: false` | disabled, hint "currently not available" |
| not an owner | no button, "Nur Inhaberinnen und Inhaber können das Abo verwalten." |
| owner, email not verified | disabled, with the reason |
| owner, verified | enabled; spinner while the handoff is requested and the browser leaves; an error text if it fails |

## Tests

- Unit: `lib/entitlements/__tests__/` (effective snapshot, version rule, lenient read of stored snapshots, limit and
  status decisions, plan events, status exemptions, UI components, portal button states and the handoff request;
  `planShell.test.tsx` renders the shell with a real React root: requests in `off` mode, mounts of the page, the dialog
  over the status view, leaving), `lib/signage/__tests__/signagePage.test.tsx` (which answers of the feed replace the
  slides), `lib/portal/__tests__/` (the contract's test vector byte for byte, claims, `iss` normalisation, both key
  spellings, invalid keys, env).
- Integration: `lib/__tests__/api/v1/entitlements.integration.test.ts` (pushes, idempotency, validation, auth, every
  guard at the limit boundary, imports, parallel creates, statuses, API keys, `freeWorkspacesPerOwner`, branding,
  unreadable stored snapshots, `ENTITLEMENTS_MODE=off`: the response bodies of representative routes, public outputs
  and the table tent stay identical with restrictive snapshots and announcements stored, and no statement touches the
  entitlement or announcement tables), `lib/__tests__/api/v1/portalHandoff.integration.test.ts` (owner token verifies with the
  public key, claims and lifetime, refused roles, unverified email, API key and master key, other tenants, availability
  per mode and env, `READ_ONLY` and `SUSPENDED`, audit without the token).
