import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';

/**
 * Returns the list of available authentication providers
 * This is used by the frontend to show the correct login buttons
 */
async function getAuthProviders(req: NextApiRequest, res: NextApiResponse) {
  const providers: Array<{ id: string; name: string; type: 'social' | 'oidc' }> = [];

  // Check for Google
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      id: 'google',
      name: 'Google',
      type: 'social',
    });
  }

  // Check for Custom OIDC
  if (process.env.CUSTOM_OIDC_NAME && process.env.CUSTOM_OIDC_ISSUER_URL && process.env.CUSTOM_OIDC_CLIENT_ID) {
    providers.push({
      id: 'custom_oidc',
      name: process.env.CUSTOM_OIDC_NAME,
      type: 'oidc',
    });
  }

  return res.status(200).json({ data: providers });
}

export default withHttpMethods({ [HTTPMethod.GET]: getAuthProviders });
