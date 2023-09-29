import prisma from '../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { Role, User } from '@prisma/client';
import { withAuthentication } from '../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const { name } = req.body;
    const result = await prisma.workspace.create({
      data: {
        name: name,
        users: {
          create: {
            userId: user.id,
            role: Role.OWNER,
          },
        },
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const result = await prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    return res.json({ data: result });
  }),
});
