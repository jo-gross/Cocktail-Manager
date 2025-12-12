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

### Workspace Management

| Variable                              | Description                                                            | Default | Example                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `DISABLE_WORKSPACE_CREATION`          | Disables workspace creation functionality (set to `"true"` to disable) | `false` | `"true"`                                                                                                        |
| `WORKSPACE_CREATION_DISABLED_MESSAGE` | HTML message displayed when workspace creation is disabled             | -       | `'Du benötigst eine Workspace?<br/>Schreibe einfach eine <a href="mailto:info@example.com">Mail ans Team</a>.'` |

**Note:** The workspace creation configuration is loaded at runtime via the `/api/config/workspace-creation` endpoint. Changes to these variables in `docker-compose.yaml` or `.env` files take effect after restarting the container (no rebuild required).

### PDF Export / Chromium Service

| Variable        | Description                                 | Default | Example            |
| --------------- | ------------------------------------------- | ------- | ------------------ |
| `CHROMIUM_HOST` | Hostname or address of the Chromium service | -       | `chromium-service` |

When `CHROMIUM_HOST` is set, the application will use the external Chromium service for PDF generation. If not set, PDF export functionality will be disabled.

### API Keys

| Variable                              | Description                                                                 | Default | Example                                    |
| ------------------------------------- | --------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `INSTANCE_MASTER_API_KEY`             | Master API Key for instance-wide access to all workspaces (full permissions) | -       | `ck_master_<your-secure-random-key-here>` |
| `API_KEY_JWT_SECRET`                  | Secret for signing and verifying JWT-based API keys                          | `NEXTAUTH_SECRET` | `your-secure-jwt-secret-here`             |
| `API_KEY_REVOKED_CACHE_TTL_MINUTES`  | TTL for revoked API keys cache in minutes                                   | `15`    | `30`                                       |

The `INSTANCE_MASTER_API_KEY` provides unrestricted access to all workspaces in the instance. This key should be:
- Kept secure and never committed to version control
- Rotated regularly
- Used only for administrative or integration purposes
- Stored in secure secret management systems in production

When set, this key can be used in the `Authorization: Bearer <key>` header to access any workspace endpoint with full permissions.

The `API_KEY_JWT_SECRET` is used to sign and verify JWT tokens for workspace API keys. If not set, it falls back to `NEXTAUTH_SECRET`. For production, it's recommended to use a separate secret for API keys.

The `API_KEY_REVOKED_CACHE_TTL_MINUTES` controls how long revoked API keys are cached in memory before checking the database again. This reduces database load when checking if a key is revoked. The default is 15 minutes. Set to a higher value (e.g., 30) for better performance at the cost of slightly delayed revocation propagation, or lower (e.g., 5) for faster revocation but more database queries.

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
```

**Note:** Variables related to workspace creation (`DISABLE_WORKSPACE_CREATION`, `WORKSPACE_CREATION_DISABLED_MESSAGE`) are loaded at runtime and can be changed without rebuilding the container.

## Runtime vs Build-time Variables

Most environment variables are read at runtime. However, some variables (like `DEPLOYMENT`) may be embedded at build time if exposed through `next.config.js`.

For runtime configuration changes:

1. Update the environment variables in your `.env` file or `docker-compose.yaml`
2. Restart the application container: `docker-compose restart cocktail-manager`
3. No rebuild is required

## Security Notes

- Never commit `.env` files to version control
- Keep all credentials secure
- In production, consider using secret management services (e.g., Docker secrets, Kubernetes secrets, AWS Secrets Manager)
- For authentication-related security notes, see [Authentication Methods](AUTH.md)
