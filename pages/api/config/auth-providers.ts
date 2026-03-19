import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Returns the list of available authentication providers
 * This is used by the frontend to show the correct login buttons
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
