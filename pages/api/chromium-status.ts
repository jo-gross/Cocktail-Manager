import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check if Chromium host is configured
  const chromiumHost = process.env.CHROMIUM_HOST;
  const isAvailable = !!chromiumHost;

  return res.status(200).json({
    available: isAvailable,
  });
}
