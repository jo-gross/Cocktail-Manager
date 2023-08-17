import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/glasses/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  const glassId = req.query.glassId as string | undefined;
  if (!glassId) return res.status(400).json({ message: 'No glass id' });

  if (req.method == 'GET') {
    return res.json(
      await prisma.glass.findUnique({
        where: {
          id: glassId,
        },
      }),
    );
  } else if (req.method === 'DELETE') {
    const result = await prisma.glass.delete({
      where: {
        id: glassId,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
