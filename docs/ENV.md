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
