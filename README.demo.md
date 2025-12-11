# Demo Mode Setup

This guide explains how to set up and run the Cocktail Manager in Demo Mode.

## Overview

Demo Mode allows potential customers to try the software without requiring login credentials. Each visitor can create a
demo workspace with pre-configured data that is automatically deleted after 24 hours.

## Quick Start

1. **Build and start the demo instance:**

```bash
docker-compose -f docker-compose.demo.yaml up -d --build
```

2. **Access the demo:**

Open your browser and navigate to `http://localhost:3001`

3. **Click "Demo starten"** to create a demo workspace

## Configuration

### Environment Variables

The demo instance uses the following environment variables (set in `docker-compose.demo.yaml`):

- `DEMO_MODE=true` - Enables demo mode
- `DEMO_WORKSPACE_CONFIG_PATH=/app/config/demo-workspace-config.json` - Path to demo configuration
- `DEMO_TTL_HOURS=24` - Time-to-live for demo workspaces in hours

### Demo Configuration File

Edit `config/demo-workspace-config.json` to customize the demo data:

- Workspace name and description
- Cocktail recipes with ingredients, steps, and garnishes
- Glasses
- Ingredients
- Garnishes

## Cleanup

The cleanup job runs automatically every hour via a cron job in the `cleanup-cron` container. It:

- Finds all expired demo workspaces (where `expiresAt < now()`)
- Deletes expired workspaces and all related data
- Deletes demo users if they have no remaining workspaces

### Manual Cleanup

You can also trigger cleanup manually:

```bash
# Via API endpoint (if running)
curl -X POST http://localhost:3001/api/demo/cleanup

# Or directly via script
docker exec cocktail-manager-demo-cleanup node scripts/cleanup-demo-workspaces.js
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

Check the cleanup logs:

```bash
docker logs cocktail-manager-demo-cleanup
```

### Database connection issues

Ensure the postgres container is running:

```bash
docker ps | grep postgres-demo
```

### Config file not found

Make sure the `config` directory is mounted correctly. The docker-compose file mounts `./config:/app/config:ro`

## Production Deployment

For production deployment, ensure:

1. Set a strong `NEXTAUTH_SECRET`
2. Set the correct `NEXTAUTH_URL`
3. Use proper database credentials
4. Configure authentication providers if needed (see `docs/AUTH.md`)

