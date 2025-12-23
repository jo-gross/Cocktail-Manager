import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.USER], Permission.QUEUE_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { queueItemId } = req.query;
    const { inProgress } = req.body;

    if (inProgress == undefined) {
      return res.status(400).json({ error: 'Missing progress' });
    }

    const cocktailQueueItem = await prisma.cocktailQueue.findFirst({
      where: {
        id: queueItemId as string,
      },
    });

    if (!cocktailQueueItem) {
      return res.status(404).json({ error: 'Queue item not found' });
    } else {
      const results = await prisma.cocktailQueue.update({
        where: {
          id: queueItemId as string,
        },
        data: {
          inProgress: inProgress,
        },
      });
      return res.json({ data: results });
    }
  }),
});
