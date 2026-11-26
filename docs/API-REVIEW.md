# API review (P3)

Review of every `/api/v1` operation and the non-versioned routes against the checklist in
[`BACKEND-CONVENTIONS.md`](BACKEND-CONVENTIONS.md). Status as of 2026-11-12 (branch `chore/backend-hardening`).

Legend for the checklist columns: **Auth** (role + API-key scope) · **Scope** (tenant isolation of path and body ids) ·
**Val** (zod, bounded) · **Tx** (transactions, locks, audit in tx) · **Err** (mapped errors, no leaks, 405) ·
**Lim** (body/rate limits) · **Test** (integration tests incl. cross-tenant).

All operations are additionally covered by three generic suites:

- `tenantIsolation.integration.test.ts` — every operation with tenant-B ids (owner session and master key): 400/404, no leak, no row changed.
- `authMatrix.integration.test.ts` — every operation: 401 without credentials, 403 below the minimum role, 403 for a key without the permission, session-only ops reject keys; master-key operations (instance API, template admin) answer 401 to everything but the master key.
- API coverage gate (`API_COVERAGE_ENFORCE=1`) — every operation answers 2xx in at least one test (allowlist: 3 PDF exports that need Chromium).

| Group | Operations | Auth | Scope | Val | Tx | Err | Lim | Test | Notable changes |
| --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Glasses, garnishes, ingredients | CRUD, clone, check, references, image, export/import JSON | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Update IDOR (takeover of foreign rows) fixed; import overwrite scoped and all-or-nothing; delete in-use check under row lock; raster-only images served with nosniff/CSP; clone audited |
| Cocktails | CRUD, clone, archive, availability, image, check, guest info | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Step/line ids must belong to the cocktail; all referenced ids scoped; per-cocktail lock; archive/availability audited |
| Cocktail import/export | JSON export/import, PDF export | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (PDF manual) | Export scoped + snapshot; import MANAGER-only, all-or-nothing, overwrite in place; PDF escaped, network restricted, max 200 ids, bounded timeout |
| Ratings, guest info | list/create/delete, bulk, overview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Ratings scoped through the cocktail, value 1–5; bulk all-or-nothing |
| Calculations | CRUD, groups, assign, export/import JSON | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Update IDOR fixed; import needs `CALCULATIONS_CREATE`, all-or-nothing; master key rejected for user-attributed writes |
| Cards | CRUD, archive, clone | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Card row lock, stable group ids, audit logs |
| Queue | list, add, remove, item update | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Atomic consume (`FOR UPDATE SKIP LOCKED`), `amount ≤ 50`, cocktail scoped |
| Statistics (+ advanced, sets) | add, list, logs, analytics, saved sets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Queue consume + statistic in one tx; saved sets need write scopes; name leak via foreign set items fixed; `limit ≤ 200` |
| Units, conversions, ice, actions | CRUD, regenerate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Regeneration in one locked tx; entity + translation atomic; explicit in-use 409s |
| Translations, content translations, tags | read/write, categories, definitions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Locked JSON merge; prototype-pollution guard; category order/defaults under lock |
| Guest menus | CRUD, draft, publish, reorder, templates, exports, QR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (PDF manual) | Create/duplicate/default under lock; audit in tx; optimistic publish (409 on stale draft) |
| Signage | settings, key, slides, slide image, public feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Tx misuse fixed; slide order + exclusive check under lock; public `includeInactive` needs the key; rate limit |
| Workspace, users, membership | workspace, settings, users, join codes, join, join requests, leave | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Only owners grant/revoke OWNER; last owner protected (Serializable); atomic one-time codes; server-generated codes; join rate limit |
| API keys, audit logs, /me, user settings | | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Key permissions from DB; key dies with creator's ADMIN role; constant-time master key compare; `limit ≤ 200` |
| Backups | export, import | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Export in RepeatableRead snapshot; import parsed + validated before the tx, ids regenerated, audited, 100 MB limit |
| Demo | create-workspace, demo-login, cleanup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Signed one-time login token; cleanup needs `DEMO_CLEANUP_SECRET` or master key; rate limits |
| Admin (master key) | create workspace, templates (list, mark, update, unmark, clone, access) | ✅ | n/a | ✅ | ✅ | ✅ | – | ✅ | Every creation path uses `createWorkspace()` (BASE template in one tx); template metadata/defaults under a global lock; built-ins read-only |
| Instance API (master key) | instance info, workspace inventory, workspace detail, user search | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ✅ | Instance-wide by design for the control plane ([INSTANCE-API.md](INSTANCE-API.md)): master key only (sessions and workspace keys 401), no `{workspaceId}` scope, so tenant isolation does not apply; reads bounded: `limit ≤ 200`, user search ≤ 50 results, `q ≤ 200` chars; fixed number of grouped queries per page; no workspace route changed |
| Instance API writes (master key) | announcements push, ownership transfer, session revocation, workspace deletion | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | Master key only; advertised only with `ENTITLEMENTS_MODE=managed`; every write in one tx with its `InstanceAuditLog` entry (actor, reason) and the answer stored per `Idempotency-Key` (retry replays, reused key 409); transfer `Serializable`, target must be a member; delete reuses the owner path (templates 409); push bounded (50 announcements, 2000 chars, 1000 targets) and serialized by a lock |
| Announcements (banner) | active announcements for the overview and for a workspace | ✅ | ✅ | ✅ | n/a | n/a | ✅ | ✅ | Session only; workspace read needs membership and only returns announcements for all or for this workspace; texts rendered as text (no HTML); dismissal in the browser |
| Entitlements | snapshot pushes (default, workspace), workspace plan, guards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pushes master key only, forward-compatible snapshot validation (known fields strict, unknown stripped), version rule under an advisory lock, written through `runControlPlaneWrite` (`InstanceAuditLog`, `Idempotency-Key`, 409 on reuse), workspace audit entry; plan read for members (`WORKSPACE_READ`); limit guards count in the write transaction under a per-key lock; status gate central in the auth middleware; all no-ops with `ENTITLEMENTS_MODE=off` ([ENTITLEMENTS.md](ENTITLEMENTS.md)) |
| Portal handoff | `POST portal/handoff` | ✅ | ✅ | ✅ | n/a | ✅ | – | ✅ | Session only, role OWNER, verified email (`403 EMAIL_NOT_VERIFIED`); offered only with `ENTITLEMENTS_MODE=managed` and valid `PORTAL_HANDOFF_PRIVATE_KEY`/`PORTAL_URL` (else `404 PORTAL_HANDOFF_UNAVAILABLE`); exempt from the status gate; Ed25519 token per request (120 s, random `jti`), `Cache-Control: no-store`; audit entry without token; token and URL never logged; no rate limit (owner sessions only, one audit row per call) ([ENTITLEMENTS.md](ENTITLEMENTS.md#portal-handoff)) |
| Templates, onboarding, guides | list, items, apply, checklist, complete, guide progress | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ | Apply: selection ids only resolve inside the template, links re-checked in the tx, one import tx; API keys need all `*_CREATE` scopes; guides session-only, rows per user bounded |
| Scraper | ingredient, image | ✅ | n/a | ✅ | n/a | ✅ | ✅ | ✅ (metro manual) | SSRF fixed via `safeFetch` (host allow-list, public IPs only, size/time limits); image proxy raster-only with sandbox CSP |
| Public | menus, images, signage feed, health | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | ✅ | `/api/health/ready` (DB + migrations) added |

Removed: all unversioned `/api/workspaces/**` routes and `/api/users/settings` (the frontend only uses `/api/v1`).

## Open follow-ups

- PDF exports (cocktails, guest menus, table tent) and the metro scraper need Chromium and are verified manually; the E2E suite (P6) should cover them.
- Guest menus: a partial unique index for "one default per workspace" (`CREATE UNIQUE INDEX … ON "GuestMenu"("workspaceId") WHERE "isDefault"`) — not added because Prisma cannot model partial indexes and `migrate dev` would try to drop it; the application lock covers it.
- Deleting a garnish still removes it from cocktails (cascade) — product decision.
- Imports through API keys only check `COCKTAILS_CREATE`, not the per-entity create scopes of implicitly created glasses/ingredients.
- `GET /statistics/cocktails` without a date range and the all-time analytics load all rows in range (performance, not isolation).
- Audit logs do not exist for units, conversions, ice, actions, tags and signage (no snapshot builder / no UI entity type).
