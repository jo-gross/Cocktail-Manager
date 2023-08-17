import prisma from '../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { Role, User } from '@prisma/client';
import { withAuthentication } from '../../../middleware/authenticationMiddleware';

export default withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  if (req.method === 'POST') {
    const { name } = req.body;
    const result = await prisma.workspace.create({
      data: {
        name: name,
        users: {
          create: {
            userId: user.id,
            role: Role.USER,
          },
        },
      },
    });
    return res.json(result);
  } else if (req.method === 'GET') {
    const result = await prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    return res.json(result);
  }

  return res.status(400).json({ message: 'Only POST is supported' });
});
