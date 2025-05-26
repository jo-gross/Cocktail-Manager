import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@generated/prisma/client';
import prisma from '../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.PUT]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const { setting, value } = req.body;
    const userResult = await prisma.userSetting.upsert({
      where: {
        userId_setting: {
          userId: user.id,
          setting: setting,
        },
      },
      create: {
        userId: user.id,
        setting: setting,
        value: value,
      },
      update: {
        value: value,
      },
    });

    return res.json({ data: userResult });
  }),
});
