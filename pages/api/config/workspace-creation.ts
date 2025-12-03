import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  return res.json({
    data: {
      disabled: process.env.DISABLE_WORKSPACE_CREATION === 'true',
      message: process.env.WORKSPACE_CREATION_DISABLED_MESSAGE || null,
    },
  });
}
