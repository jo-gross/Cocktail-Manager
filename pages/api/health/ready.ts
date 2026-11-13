import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../prisma/prisma';
import packageJson from '../../../package.json';

/**
 * Readiness probe for deployments and the E2E release gate: the database is
 * reachable and every migration shipped with this build has been applied.
 * Returns 503 with the failing checks otherwise. Exposes no secrets.
 */
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }

  const checks: Record<string, { ok: boolean; detail?: unknown }> = {};

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

  const ok = Object.values(checks).every((check) => check.ok);
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not-ready',
    version: packageJson.version,
    commit: process.env.GIT_SHA || null,
    checks,
  });
}
