import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { User } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';

/** The session user's own profile and settings. */
export default withHttpMethods({
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const userResult = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        settings: true,
      },
    });

    return res.json({ data: userResult });
  }),
});
