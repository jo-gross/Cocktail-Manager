import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { isPdfServiceConfigured } from '@lib/pdf/browser';

/** Whether a Chromium (PDF) service is configured. Exposes only a boolean, never the host. */
export default withHttpMethods({
  [HTTPMethod.GET]: async (_req: NextApiRequest, res: NextApiResponse) => {
    return res.status(200).json({ available: isPdfServiceConfigured() });
  },
});
