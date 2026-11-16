# Demo Mode Setup

This guide explains how to set up and run the Cocktail Manager as a demo instance.

## Overview

Demo Mode allows potential customers to try the software without requiring login credentials. Each visitor gets a
throw-away demo user and workspace that is automatically deleted after 24 hours:

- **Start demo:** a complete sample bar (recipes in German and English, two cocktail cards, a published guest menu,
  digital signage, a calculation) in the visitor's language, with generated activity (statistics of the last 14 days,
  ratings, queue). The basics tour is offered in the bar view.
- **Try the setup:** an empty workspace that starts in the setup assistant.

The demo is a separate instance of the **regular image**: `DEMO_MODE=true` at runtime switches it to demo mode, no
special build is needed.

## Quick Start

1. **Start the demo instance:**

```bash
docker-compose -f docker-compose.demo.yaml up -d
```

The compose file uses the regular image `ghcr.io/jo-gross/cocktail-manager:latest` (built by the release workflow).

**To build locally instead** (e.g., for development), uncomment the `build` section and comment out the `image` line in
`docker-compose.demo.yaml`, then run:

```bash
docker-compose -f docker-compose.demo.yaml up -d --build
```

2. **Access the demo:** open `http://localhost:3001`
3. **Click "Demo starten"** (or "Einrichtung ausprobieren")

For local development without Docker: `DEMO_MODE=true pnpm dev` (see `.env.demo`).

## Configuration

### Environment Variables

- `DEMO_MODE=true` - Enables demo mode (runtime; the client reads it from `GET /api/config/demo`)
- `DEMO_TTL_HOURS=24` - Time-to-live for demo workspaces in hours
- `DEMO_CLEANUP_SECRET` - Optional bearer secret for `POST /api/demo/cleanup`

See [docs/ENV.md](docs/ENV.md#demo-mode) for details.

### Demo Content

The content comes from the built-in `DEMO` template [`templates/demo/`](templates/demo/README.md) (manifest, backup
format, images). It is copied into the database on start; each demo clones the default `DEMO` template in the
visitor's language. To change the content, maintain it in a workspace and pull it back into the repo with
`pnpm templates:pull` – see [`templates/demo/README.md`](templates/demo/README.md).

## Cleanup

The app process deletes expired demo workspaces every hour (started in `instrumentation.ts` when `DEMO_MODE=true`):

- Finds all expired demo workspaces (where `expiresAt <= now()`)
- Deletes expired workspaces and all related data
- Deletes demo users if they have no remaining workspaces

Errors are logged (`[DemoCleanup]`); the next run tries again.

### Manual Cleanup

```bash
curl -X POST -H "Authorization: Bearer $DEMO_CLEANUP_SECRET" http://localhost:3001/api/demo/cleanup
```

## Ports

The demo instance uses different ports to avoid conflicts with production:

- **Application:** `3001` (instead of 3000)
- **PostgreSQL:** `5433` (instead of 5432)
- **Chromium:** `9223` (instead of 9222)

## Database

The demo uses a separate database (`cocktail_recipe_demo`) to ensure complete isolation from production data.

## Stopping the Demo

```bash
docker-compose -f docker-compose.demo.yaml down
```

To also remove volumes (including database data):

```bash
docker-compose -f docker-compose.demo.yaml down -v
```

## Troubleshooting

### Cleanup not working

Check the application logs for `[DemoCleanup]` entries:

```bash
docker logs cocktail-manager-demo 2>&1 | grep DemoCleanup
```

### Database connection issues

Ensure the postgres container is running:

```bash
docker ps | grep postgres-demo
```

### Demo button missing

The start page shows the demo buttons only when `GET /api/config/demo` returns `enabled: true`, i.e. the container runs
with `DEMO_MODE=true`.

## Production Deployment

For production deployment, ensure:

1. Set a strong `BETTER_AUTH_SECRET`
2. Set the correct `BETTER_AUTH_URL`
3. Use proper database credentials
4. Set `TRUST_PROXY=true` behind a reverse proxy, so the per-IP rate limit of demo creation works
