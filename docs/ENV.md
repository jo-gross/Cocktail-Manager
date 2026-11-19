# Environment Variables

This document describes all environment variables that can be configured for the Cocktail Manager application.

## Required Variables

### Database

| Variable       | Description                           | Example                                                   |
| -------------- | ------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL database connection string | `postgres://user:password@localhost:5432/cocktail_recipe` |

### Authentication

For authentication-related environment variables, see [Authentication Methods](AUTH.md).

## Optional Variables

### Deployment

| Variable     | Description                       | Default | Example                                |
| ------------ | --------------------------------- | ------- | -------------------------------------- |
| `DEPLOYMENT` | Deployment environment identifier | -       | `production`, `staging`, `development` |
| `NODE_ENV`   | Node.js environment mode          | -       | `production`, `development`            |

### Reverse Proxy / Public URL

| Variable              | Description                                                                                                                                                                                                                              | Default | Example                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------- |
| `TRUST_PROXY`         | Which proxy headers identify the client IP for rate limits (guest menu PIN attempts, public menu/image endpoints). `false`/unset: socket address only. `true` or a number N: N-th `X-Forwarded-For` entry from the right (`true` = 1 = the address your nearest proxy saw), fallback `X-Real-IP`. `cloudflare`: `CF-Connecting-IP`. | `false` | `true`, `2`, `cloudflare`               |

**Reverse proxy setups (nginx, Traefik, Caddy, Cloudflare, …):** set `TRUST_PROXY`. Without it every request reaches the app from the proxy's address, so all guests share **one** rate-limit bucket (a few wrong PIN entries by one guest can briefly lock out others). Only trust as many hops as you actually run – a client can prepend arbitrary entries to `X-Forwarded-For`, which is why the entries are counted from the right. Only use `cloudflare` if the app is reachable exclusively through Cloudflare. If an `X-Forwarded-For` header arrives while `TRUST_PROXY` is unset, the server logs a one-time warning.

**Public URL:** canonical/`og:url` links and QR codes of guest menus use `NEXT_PUBLIC_APP_URL` (inlined at build time), `NEXTAUTH_URL` or `BETTER_AUTH_URL` (runtime, see [Authentication Methods](AUTH.md)). If none is set, the origin is taken from the request's `Host`/`X-Forwarded-Host` headers (logged once as a warning) – a spoofed `Host` header could then end up in cached guest menu pages. Set `BETTER_AUTH_URL` to the public URL in production.

Independently of the client IP, guest menu PIN entry is limited per menu: after 30 wrong codes within about 10 minutes (from any IP) new unlock attempts get `429` with `Retry-After` until the budget refills; guests that already unlocked the menu are not affected.

### Workspace Management

| Variable                              | Description                                                            | Default | Example                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `DISABLE_WORKSPACE_CREATION`          | Disables workspace creation functionality (set to `"true"` to disable) | `false` | `"true"`                                                                                                        |
| `WORKSPACE_CREATION_DISABLED_MESSAGE` | HTML message displayed when workspace creation is disabled             | -       | `'Du benötigst eine Workspace?<br/>Schreibe einfach eine <a href="mailto:info@example.com">Mail ans Team</a>.'` |

**Note:** The workspace creation configuration is loaded at runtime via the `/api/config/workspace-creation` endpoint. Changes to these variables in `docker-compose.yaml` or `.env` files take effect after restarting the container (no rebuild required).

### External Workspace Management

| Variable                        | Description                                                                    | Default | Example                             |
| ------------------------------- | ------------------------------------------------------------------------------ | ------- | ----------------------------------- |
| `EXTERNAL_WORKSPACE_MANAGEMENT` | Enables external workspace management via OIDC (set to `"true"` to enable)     | `false` | `"true"`                            |
| `CUSTOM_OIDC_GROUPS_KEY`        | The claim key in the OIDC user profile that contains the user's groups or roles | -       | `"groups"`, `"roles"`, `"memberOf"` |
| `EXTERNAL_WORKSPACE_MAPPINGS`   | JSON configuration mapping OIDC groups to workspaces and roles                 | -       | See example below                   |

**EXTERNAL_WORKSPACE_MAPPINGS Configuration:**

This variable accepts a JSON array of workspace configurations. Each configuration specifies a `workspaceId`, an optional `workspaceName`, and a list of `mappings` between OIDC groups and application roles.

**Example:**

```json
[
  {
    "workspaceId": "ws-admin-1",
    "workspaceName": "Admin Workspace",
    "mappings": [
      { "oidcGroup": "cocktail-admins", "role": "ADMIN" },
      { "oidcGroup": "finance-team", "role": "MANAGER" }
    ]
  },
  {
    "workspaceId": "ws-user-1",
    "workspaceName": "User Workspace",
    "mappings": [
      { "oidcGroup": "cocktail-users", "role": "USER" }
    ]
  }
]
```

**Behavior:**

- **Workspace Creation**: If a mapped workspace ID does not exist, it is automatically created with the specified `workspaceName` (or `workspaceId` if name is missing).
- **Role Assignment**: When a user logs in, their OIDC groups are checked against the mappings. The user is added to the workspace with the highest resolved role.
- **Role Updates**: User roles in externally managed workspaces are **only** updated upon login. Local role management is disabled for these workspaces.

### PDF Export / Chromium Service

| Variable        | Description                                 | Default | Example            |
| --------------- | ------------------------------------------- | ------- | ------------------ |
| `CHROMIUM_HOST` | Hostname or address of the Chromium service | -       | `chromium-service` |

When `CHROMIUM_HOST` is set, the application will use the external Chromium service for PDF generation. If not set, PDF export functionality will be disabled.

### API Keys

| Variable                              | Description                                                                 | Default | Example                                    |
| ------------------------------------- | --------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `INSTANCE_MASTER_API_KEY`             | Master API Key for instance-wide access to all workspaces (full permissions) | -       | `ck_master_<your-secure-random-key-here>` |
| `API_KEY_JWT_SECRET`                  | Secret for signing and verifying JWT-based API keys                          | `BETTER_AUTH_SECRET` | `your-secure-jwt-secret-here`             |
| `API_KEY_REVOKED_CACHE_TTL_MINUTES`  | TTL for revoked API keys cache in minutes                                   | `15`    | `30`                                       |

The `INSTANCE_MASTER_API_KEY` provides unrestricted access to all workspaces in the instance. This key should be:
- Kept secure and never committed to version control
- Rotated regularly
- Used only for administrative or integration purposes
- Stored in secure secret management systems in production

When set, this key can be used in the `Authorization: Bearer <key>` header to access any workspace endpoint with full permissions.

The master key also authenticates the read-only instance API for a hosting control plane (`/api/v1/instance/**`, see
[Instance API](INSTANCE-API.md)). Without the key these routes answer `401`.

The `API_KEY_JWT_SECRET` is used to sign and verify JWT tokens for workspace API keys. If not set, it falls back to `BETTER_AUTH_SECRET`. For production, it's recommended to use a separate secret for API keys.

The `API_KEY_REVOKED_CACHE_TTL_MINUTES` controls how long revoked API keys are cached in memory before checking the database again. This reduces database load when checking if a key is revoked. The default is 15 minutes. Set to a higher value (e.g., 30) for better performance at the cost of slightly delayed revocation propagation, or lower (e.g., 5) for faster revocation but more database queries.

### Hosting / Control Plane

| Variable            | Description                                                                                                  | Default | Example   |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------- | --------- |
| `ENTITLEMENTS_MODE` | `off`: self-hosted, no plan limits. `managed`: the instance is hosted and a control plane manages entitlements | `off`   | `managed` |
| `ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER` | Only with `managed`: how many workspaces on the default (free) plan a user may own when creating one in the app; unset = unlimited | - | `1` |

Self-hosted instances leave both unset. `ENTITLEMENTS_MODE` is reported as `entitlementsMode` by
`GET /api/v1/instance` (see [Instance API](INSTANCE-API.md)). With `managed` the instance advertises the capabilities
`entitlements`, `announcements` (banners pushed by the control plane) and `support.write` (ownership transfer, session
revocation, workspace deletion) to the control plane, enforces the plan snapshots the control plane pushes (limits,
features, workspace status) and shows the plan UI; until the first push nothing is limited. See
[Entitlements](ENTITLEMENTS.md). Values other than `off` and `managed` (case-insensitive) count as `off` and are logged
once at runtime as a warning.
`ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER` takes a non-negative integer; other values count as unlimited. It applies only
after the control plane pushed a default snapshot.

#### Customer portal ("Abo verwalten")

| Variable                     | Description                                                                                                       | Default | Example                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------- |
| `PORTAL_HANDOFF_PRIVATE_KEY` | Ed25519 private key (PKCS#8 PEM) that signs the handoff into the customer portal. **Secret.**                       | -       | see below                    |
| `PORTAL_URL`                 | Base URL of the customer portal of the hosting provider; the app sends owners to `<PORTAL_URL>/sso?token=…`       | -       | `https://portal.example.com` |

Owners of a workspace with a verified email address get "Abo verwalten" (plan card, status banner, suspended view) and
"Upgrade" (limit dialog), which sign them in on the page of their bar in the customer portal (see
[Entitlements](ENTITLEMENTS.md#portal-handoff)). The handoff is offered only when **all** of these hold; otherwise the
app behaves as without the variables and self-hosted instances see nothing:

- `ENTITLEMENTS_MODE=managed`
- `PORTAL_HANDOFF_PRIVATE_KEY` is a valid Ed25519 private key
- `PORTAL_URL` is an http(s) URL
- the public URL of the app is set: `BETTER_AUTH_URL`, else `NEXTAUTH_URL`, else `NEXT_PUBLIC_APP_URL` (the same order
  as the auth base URL). Its origin (scheme, host, port; no path, no default port) is the issuer (`iss`) of the token
  and must equal the origin of the public URL registered for the instance in the backoffice ("Aussteller (iss) im
  Token").

The backoffice generates the key pair (instance detail page, "Wechsel aus der App") and shows the private key once as
an env line. Both spellings are accepted: the PEM with real line breaks, or one line with `\n` for each line break,
optionally in double quotes:

```bash
PORTAL_HANDOFF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQAw…\n-----END PRIVATE KEY-----"
```

A key made elsewhere: `openssl genpkey -algorithm ed25519 -out handoff.pem` (private key for the app) and
`openssl pkey -in handoff.pem -pubout` (public key for the backoffice). An invalid key, an invalid `PORTAL_URL` or a
missing public URL is logged once as a warning, never with the value. To rotate, enter the new key in the backoffice,
then set it here and restart the app; until then handoffs fail.

### Demo Mode

| Variable              | Description                                                                                                                                          | Default | Example                |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|---------|------------------------|
| `DEMO_MODE`           | Turns the instance into a demo instance (`"true"`); read at runtime, the regular image is used                                                       | `false` | `"true"`               |
| `DEMO_TTL_HOURS`      | Time-to-live for demo workspaces in hours                                                                                                            | `24`    | `24`                   |
| `DEMO_CLEANUP_SECRET` | Bearer secret for `POST /api/demo/cleanup` (alternatively the `INSTANCE_MASTER_API_KEY`); without it only the master key can trigger the cleanup | -       | `openssl rand -hex 32` |

**Note:** When `DEMO_MODE` is enabled:

- The start page offers "Start demo" (sample bar) and "Try the setup" (empty workspace in the setup assistant)
  instead of the login providers; the client reads the flag from `GET /api/config/demo`.
- Each demo is a throw-away user plus a workspace created from the default `DEMO` template (`templates/demo/`, see
  [`templates/demo/README.md`](../templates/demo/README.md)) in the visitor's language, with generated sample activity
  (statistics of the last 14 days, ratings, queue).
- Demo workspaces are deleted after the TTL: the app process runs the cleanup hourly (`instrumentation.ts`).
- Demo mode configuration is loaded at runtime. Changes take effect after restarting the container (no rebuild
  required).
- `POST /api/demo/create-workspace` (body `{ "locale": "de" | "en", "mode": "full" | "setup" }`, both optional) is
  rate-limited per client IP (5 per hour, see `TRUST_PROXY`) and returns a short-lived (5 min), single-use
  `loginToken` (HMAC with `BETTER_AUTH_SECRET`); `POST /api/auth/demo-login` only creates a session for that token.
- `POST /api/demo/cleanup` (manual or external trigger) requires `Authorization: Bearer <DEMO_CLEANUP_SECRET>` or the
  master key.

### Backups

Workspace backups (`/api/v1/workspaces/{id}/admin/backups/import`) embed all images as base64. The request body limit is
**100 MB** (set in the route file); larger backups have to be split or have their images compressed. Imports are
all-or-nothing: the file is validated completely first (invalid structure or broken references → `400`, nothing
written) and then written in a single transaction (max. 10 minutes).

### E-Mail / SMTP

Email notifications (e.g. for workspace join requests) are only sent when SMTP is configured and `EMAIL_TEMPLATE_CONFIG` is set and valid. If `SMTP_HOST` is not set, no email is sent. If SMTP is set but `EMAIL_TEMPLATE_CONFIG` is missing or invalid, an error is logged and no email is sent.

| Variable        | Description                                                                 | Default | Example              |
| --------------- | --------------------------------------------------------------------------- | ------- | -------------------- |
| `SMTP_HOST`     | SMTP server hostname or address                                             | -       | `localhost`, `fake-smtp` |
| `SMTP_PORT`     | SMTP port                                                                   | `8025`  | `8025`, `587`        |
| `SMTP_SECURE`   | Use TLS (set to `"true"` for TLS)                                           | `false` | `"true"`             |
| `SMTP_USER`     | SMTP username (optional, e.g. for auth)                                     | -       | `user`               |
| `SMTP_PASSWORD` | SMTP password (optional)                                                    | -       | `secret`             |
| `MAIL_FROM`     | Sender email address                                                        | `noreply@localhost` | `noreply@example.com` |
| `MAIL_FROM_NAME`| Sender display name                                                         | `Cocktail Manager` | `Cocktail Manager` |
| `EMAIL_TEMPLATE_CONFIG` | **JSON object** (as string). Required when SMTP is enabled. Contains: `appUrl` (app base URL, for links and logo), `supportEmail` (support email, used as `mailto:` link), optional `impressumUrl` (default: `appUrl`). If a required value is missing, no email is sent. See [Email documentation](EMAIL.md). | -       | See example below    |

**Example `EMAIL_TEMPLATE_CONFIG`** (single line in `.env` or escaped JSON in the environment):

```json
{"appUrl":"http://localhost:3000","supportEmail":"support@cocktail-manager.de","impressumUrl":"http://localhost:3000"}
```

**Local testing:** For local testing you can use [fake-smtp-server](https://github.com/gessnerfl/fake-smtp-server) via Docker (see [Email documentation](EMAIL.md)). A `fake-smtp` service is defined in `docker-compose.yaml`; SMTP port 8025, Web UI on port 8080. Set e.g. `SMTP_HOST=localhost` (when the app runs locally) or `SMTP_HOST=fake-smtp` (when the app runs in the Docker network), `SMTP_PORT=8025`, and `EMAIL_TEMPLATE_CONFIG` as in the example above.

## Configuration Files

### .env File

For local development, create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit the `.env` file with your configuration values.

### docker-compose.yaml

For Docker deployments, environment variables can be set in the `docker-compose.yaml` file:

```yaml
environment:
  - DATABASE_URL=postgres://postgres:postgres@postgres:5432/cocktail_recipe
  - DISABLE_WORKSPACE_CREATION=true
  - WORKSPACE_CREATION_DISABLED_MESSAGE='Your message here'
  # Behind a reverse proxy (see "Reverse Proxy / Public URL")
  - TRUST_PROXY=true
```

**Note:** Variables related to workspace creation (`DISABLE_WORKSPACE_CREATION`, `WORKSPACE_CREATION_DISABLED_MESSAGE`) are loaded at runtime and can be changed without rebuilding the container.

## Runtime vs Build-time Variables

Most environment variables are read at runtime. However, some variables (like `DEPLOYMENT`) may be embedded at build time if exposed through `next.config.mjs`.

For runtime configuration changes:

1. Update the environment variables in your `.env` file or `docker-compose.yaml`
2. Restart the application container: `docker-compose restart cocktail-manager`
3. No rebuild is required

## Security Notes

- Never commit `.env` files to version control
- Keep all credentials secure
- In production, consider using secret management services (e.g., Docker secrets, Kubernetes secrets, AWS Secrets Manager)
- For authentication-related security notes, see [Authentication Methods](AUTH.md)
