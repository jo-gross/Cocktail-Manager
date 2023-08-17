import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/garnish/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });
  const garnishId = req.query.garnishId as string | undefined;
  if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

  if (req.method == 'GET') {
    return res.json(
      await prisma.garnish.findUnique({
        where: {
          id: garnishId,
        },
      }),
    );
  } else if (req.method === 'DELETE') {
    const result = await prisma.garnish.delete({
      where: {
        id: garnishId,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
