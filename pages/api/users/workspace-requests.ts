import { NextApiRequest, NextApiResponse } from 'next';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { User } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';

export default withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  const openWorkspaceRequests = await prisma.workspaceJoinRequest.findMany({
    where: {
      userId: user.id,
    },
    include: {
      workspace: true,
    },
  });

  return res.json({ data: openWorkspaceRequests });
});
