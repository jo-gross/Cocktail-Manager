/**
 * Readiness checks shared by `/api/health/ready` and `GET /api/v1/instance`: the database is reachable and every
 * migration shipped with this build has been applied. Exposes no secrets.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import prisma from '../../prisma/prisma';

export interface ReadinessCheck {
  ok: boolean;
  detail?: unknown;
}

function shippedMigrations(): string[] | null {
  try {
    return readdirSync(join(process.cwd(), 'prisma', 'migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }
}

export async function readinessChecks(): Promise<Record<string, ReadinessCheck>> {
  const checks: Record<string, ReadinessCheck> = {};

  let applied: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }> = [];
  try {
    applied = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    checks.database = { ok: true };
  } catch {
    checks.database = { ok: false };
  }

  if (checks.database.ok) {
    const done = new Set(applied.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
    const failed = applied.filter((row) => !row.finished_at && !row.rolled_back_at).map((row) => row.migration_name);
    const shipped = shippedMigrations();
    const pending = shipped ? shipped.filter((name) => !done.has(name)) : [];
    checks.migrations = {
      ok: failed.length === 0 && pending.length === 0,
      detail: { applied: done.size, pending, failed, shippedKnown: shipped !== null },
    };
  }

  return checks;
}

export function allChecksOk(checks: Record<string, ReadinessCheck>): boolean {
  return Object.values(checks).every((check) => check.ok);
}
