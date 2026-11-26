import { NextApiRequest, NextApiResponse } from 'next';
import { allChecksOk, readinessChecks } from '@lib/health/readiness';
import packageJson from '../../../package.json';

/**
 * Readiness probe for deployments and the E2E release gate: the database is
 * reachable and every migration shipped with this build has been applied.
 * Returns 503 with the failing checks otherwise. Exposes no secrets.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }

  const checks = await readinessChecks();
  const ok = allChecksOk(checks);
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not-ready',
    version: packageJson.version,
    commit: process.env.GIT_SHA || null,
    checks,
  });
}
