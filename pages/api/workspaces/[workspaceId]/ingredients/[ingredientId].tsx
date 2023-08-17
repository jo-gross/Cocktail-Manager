import prisma from '../../../../../lib/prisma';

import { NextApiRequest, NextApiResponse } from 'next';
// DELETE /api/ingredients/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  const ingredientId = req.query.ingredientId as string | undefined;
  if (!ingredientId) return res.status(400).json({ message: 'No ingredient id' });

  if (req.method == 'GET') {
    return res.json(
      await prisma.ingredient.findUnique({
        where: {
          id: ingredientId,
        },
      }),
    );
  } else if (req.method === 'DELETE') {
    const result = await prisma.ingredient.delete({
      where: {
        id: ingredientId,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
