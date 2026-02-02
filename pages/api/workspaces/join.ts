import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import prisma from '../../../prisma/prisma';
import { constants as HttpStatus } from 'http2';
import { Role } from '@generated/prisma/client';
import { sendJoinRequestNotificationToManagers } from '@lib/email/joinRequestNotifications';

type JoinResult =
  | { type: 'created'; result: unknown; workspaceId: string; applicantUserId: string }
  | { type: 'joined'; result: unknown }
  | { type: 'error'; status: number; body: unknown };

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req, res, user) => {
    try {
      const txResult = await prisma.$transaction(async (transaction): Promise<JoinResult> => {
        const code = req.query.code as string | undefined;
        console.log('Code:', code);
        if (!code) {
          return { type: 'error', status: HttpStatus.HTTP_STATUS_BAD_REQUEST, body: undefined };
        }

        const findWorkspace = await transaction.workspaceJoinCode.findUnique({
          where: {
            code: code,
          },
        });

        if (!findWorkspace) {
          console.log('Code not found');
          return { type: 'error', status: HttpStatus.HTTP_STATUS_BAD_REQUEST, body: undefined };
        }

        const workspaceUser = await transaction.workspaceUser.findFirst({
          where: {
            userId: user.id,
            workspaceId: findWorkspace.workspaceId,
          },
        });
        if (workspaceUser) {
          console.log('User already in workspace');
          return {
            type: 'error',
            status: HttpStatus.HTTP_STATUS_BAD_REQUEST,
            body: { data: { key: 'ALREADY_IN_WORKSPACE' } },
          };
        }

        if (findWorkspace.expires && findWorkspace.expires <= new Date()) {
          console.log('Code expired');
          return { type: 'error', status: HttpStatus.HTTP_STATUS_BAD_REQUEST, body: undefined };
        }

        if (findWorkspace.onlyUseOnce && findWorkspace.used > 0) {
          console.log('Code already used');
          return { type: 'error', status: HttpStatus.HTTP_STATUS_BAD_REQUEST, body: undefined };
        }

        // Check if workspace is empty (no users)
        const workspaceUsersCount = await transaction.workspaceUser.count({
          where: {
            workspaceId: findWorkspace.workspaceId,
          },
        });

        // If workspace is empty, add user directly as OWNER
        if (workspaceUsersCount === 0) {
          const result = await transaction.workspaceUser.create({
            data: {
              userId: user.id,
              workspaceId: findWorkspace.workspaceId,
              role: Role.OWNER,
            },
          });

          // Delete join code after successful join (no longer needed)
          await transaction.workspaceJoinCode.delete({
            where: {
              code: code,
            },
          });

          return { type: 'joined', result };
        }

        // Workspace has users - check for existing join request
        const workspaceRequests = await transaction.workspaceJoinRequest.findFirst({
          where: {
            userId: user.id,
            workspaceId: findWorkspace.workspaceId,
          },
        });
        if (workspaceRequests) {
          console.log('User already requested to join workspace');
          return {
            type: 'error',
            status: HttpStatus.HTTP_STATUS_BAD_REQUEST,
            body: { data: { key: 'JOIN_ALREADY_REQUESTED' } },
          };
        }

        // Create join request (needs approval)
        await transaction.workspaceJoinCode.update({
          where: {
            code: code,
          },
          data: {
            used: findWorkspace.used + 1,
          },
        });

        const result = await transaction.workspaceJoinRequest.create({
          data: {
            userId: user.id,
            workspaceId: findWorkspace.workspaceId,
          },
        });
        return {
          type: 'created',
          result,
          workspaceId: findWorkspace.workspaceId,
          applicantUserId: user.id,
        };
      });

      if (txResult.type === 'error') {
        return res.status(txResult.status).json(txResult.body);
      }
      if (txResult.type === 'joined') {
        return res.json({ data: txResult.result });
      }
      // type === 'created'
      res.json({ data: txResult.result });
      sendJoinRequestNotificationToManagers(txResult.workspaceId, txResult.applicantUserId).catch((err) =>
        console.error('[join] Failed to send notification emails', err),
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
