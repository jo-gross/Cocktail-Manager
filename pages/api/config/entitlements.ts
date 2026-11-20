import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { entitlementsMode } from '@lib/instance/config';

/**
 * `ENTITLEMENTS_MODE` for the browser (docs/ENTITLEMENTS.md): the plan UI and the announcement banner only load their
 * data with `managed`, so self-hosted instances make no further requests. Public, no database, cached by the browser.
 */
async function getEntitlementsConfig(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.json({ data: { mode: entitlementsMode() } });
}

export default withHttpMethods({ [HTTPMethod.GET]: getEntitlementsConfig });
