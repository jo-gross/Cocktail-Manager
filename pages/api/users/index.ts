import { NextApiRequest, NextApiResponse } from 'next';
import { withAuthentication } from '../../../middleware/api/authenticationMiddleware';
import { User } from '@prisma/client';
import prisma from '../../../lib/prisma';

export default withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  const userResult = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      settings: true,
    },
  });

  return res.json({ data: userResult });
});
