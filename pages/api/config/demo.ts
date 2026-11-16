import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { getDemoTtlHours, isDemoMode } from '@lib/demo/config';

/** Public: whether this instance is a demo instance (runtime `DEMO_MODE`, no rebuild needed). */
async function getDemoConfig(req: NextApiRequest, res: NextApiResponse) {
  const enabled = isDemoMode();
  return res.json({ data: { enabled, ttlHours: enabled ? getDemoTtlHours() : null } });
}

export default withHttpMethods({ [HTTPMethod.GET]: getDemoConfig });
