import prisma from '../../../lib/prisma';

import { NextApiRequest, NextApiResponse } from 'next';
// DELETE /api/ingredients/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string | undefined;
  if (id == undefined) {
    return res.status(400).json({ message: 'id is undefined' });
  } else if (req.method == 'GET') {
    return res.json(
      await prisma.ingredient.findUnique({
        where: {
          id: id,
        },
      }),
    );
  } else if (req.method === 'DELETE') {
    const result = await prisma.ingredient.delete({
      where: {
        id: id,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
