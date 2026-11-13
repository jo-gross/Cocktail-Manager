import { NextApiRequest, NextApiResponse } from 'next';
import packageJson from '../../../package.json';

/** Liveness probe (Docker HEALTHCHECK). No dependencies; see /api/health/ready for readiness. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok', version: packageJson.version, commit: process.env.GIT_SHA || null });
}
