import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import prisma from '../../../../../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { sendJoinRequestAcceptedToUser } from '@lib/email/joinRequestNotifications';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    const userId = req.query.userId as string;
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.workspaceJoinRequest.delete({
          where: {
            userId_workspaceId: {
              workspaceId: workspace.id,
              userId,
            },
          },
        });
        await transaction.workspaceUser.create({
          data: {
            userId,
            workspaceId: workspace.id,
            role: Role.USER,
          },
        });
      });
      sendJoinRequestAcceptedToUser(workspace.id, userId).catch((err) => console.error('[accept] Failed to send notification email', err));
      return res.json({ data: 'ok' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
