import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { User } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';

/** The session user's pending join requests — only the requested workspace's id and name. */
export default withHttpMethods({
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const openWorkspaceRequests = await prisma.workspaceJoinRequest.findMany({
      where: {
        userId: user.id,
      },
      select: {
        workspaceId: true,
        userId: true,
        date: true,
        workspace: { select: { id: true, name: true } },
      },
    });

    return res.json({ data: openWorkspaceRequests });
  }),
});
