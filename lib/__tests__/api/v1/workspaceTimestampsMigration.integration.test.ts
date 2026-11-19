/**
 * The workspace timestamps migration on a database that already has workspaces: a scratch database gets every
 * migration before it, existing data, and then the migration itself.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');
const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const target = migrations.find((name) => name.endsWith('_workspace_timestamps'))!;
const before = migrations.slice(0, migrations.indexOf(target));

const baseUrl = new URL(process.env.DATABASE_URL!);
const scratchName = `${baseUrl.pathname.slice(1)}_ts_backfill_${process.pid}`;
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${scratchName}`;

const admin = new Client({ connectionString: baseUrl.toString() });
const db = new Client({ connectionString: scratchUrl.toString() });

const migrationSql = (name: string) => readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');

describe('migration workspace_timestamps', () => {
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${scratchName}"`);
    await admin.query(`CREATE DATABASE "${scratchName}"`);
    await db.connect();
    await db.query(`SET TIME ZONE 'UTC'`);
    for (const name of before) await db.query(migrationSql(name));
  });

  afterAll(async () => {
    await db.end();
    await admin.query(`DROP DATABASE IF EXISTS "${scratchName}"`);
    await admin.end();
  });

  it('back-fills createdAt from the oldest audit log entry, otherwise the migration time, and keeps updatedAt current', async () => {
    await db.query(`INSERT INTO "Workspace" ("id", "name") VALUES ('ws-old', 'Old Bar'), ('ws-new', 'New Bar')`);
    await db.query(`INSERT INTO "User" ("id", "name", "email") VALUES ('u-1', 'Owner', 'owner@test.local')`);
    await db.query(`INSERT INTO "WorkspaceUser" ("workspaceId", "userId", "role") VALUES ('ws-old', 'u-1', 'OWNER')`);
    await db.query(`
      INSERT INTO "AuditLog" ("id", "workspaceId", "entityType", "entityId", "action", "createdAt") VALUES
        ('log-1', 'ws-old', 'Cocktail', 'c-1', 'UPDATE', '2025-03-01 10:00:00'),
        ('log-2', 'ws-old', 'Cocktail', 'c-1', 'CREATE', '2024-05-01 08:30:00'),
        ('log-3', 'ws-old', 'Glass', 'g-1', 'CREATE', '2025-01-01 00:00:00')`);

    const startedAt = Date.now();
    await db.query(migrationSql(target));

    const { rows } = await db.query<{ id: string; createdAt: Date; updatedAt: Date }>(`SELECT "id", "createdAt", "updatedAt" FROM "Workspace" ORDER BY "id"`);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    // timestamp(3) columns come back as local-time Dates from pg; compare via ISO in UTC (session time zone is UTC).
    const utc = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    expect(utc(byId['ws-old']!.createdAt).toISOString()).toBe('2024-05-01T08:30:00.000Z');
    for (const id of ['ws-new']) expect(Math.abs(utc(byId[id]!.createdAt).getTime() - startedAt)).toBeLessThan(60_000);
    for (const id of ['ws-old', 'ws-new']) expect(Math.abs(utc(byId[id]!.updatedAt).getTime() - startedAt)).toBeLessThan(60_000);

    // The triggers exist after the migration: a role change moves updatedAt, a visit does not.
    const touched = async () =>
      utc((await db.query<{ updatedAt: Date }>(`SELECT "updatedAt" FROM "Workspace" WHERE "id" = 'ws-old'`)).rows[0]!.updatedAt).getUTCFullYear();
    // The self trigger overrides any explicit value, so reset it with the trigger disabled.
    await db.query(`ALTER TABLE "Workspace" DISABLE TRIGGER "workspace_touch_self"`);
    await db.query(`UPDATE "Workspace" SET "updatedAt" = '2000-01-01' WHERE "id" = 'ws-old'`);
    await db.query(`ALTER TABLE "Workspace" ENABLE TRIGGER "workspace_touch_self"`);
    expect(await touched()).toBe(2000);
    await db.query(`UPDATE "WorkspaceUser" SET "lastOpened" = now() WHERE "workspaceId" = 'ws-old'`);
    expect(await touched()).toBe(2000);
    await db.query(`UPDATE "WorkspaceUser" SET "role" = 'ADMIN' WHERE "workspaceId" = 'ws-old'`);
    expect(await touched()).toBeGreaterThan(2000);

    // Deleting a workspace cascades to its members without tripping the member trigger.
    await db.query(`DELETE FROM "Workspace" WHERE "id" = 'ws-old'`);
    expect((await db.query(`SELECT 1 FROM "WorkspaceUser" WHERE "workspaceId" = 'ws-old'`)).rowCount).toBe(0);
  });
});
