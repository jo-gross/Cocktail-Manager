import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role, Workspace } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    Permission.WORKSPACE_READ,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
      const { entityType, entityId, limit = '50', page = '1' } = req.query;

      const pageInt = parseInt(page as string);
      const limitInt = parseInt(limit as string);
      const skip = (pageInt - 1) * limitInt;

      const where: any = {
        workspaceId: workspace.id,
      };

      if (entityType) {
        where.entityType = entityType as string;
      }
      if (entityId) {
        where.entityId = entityId as string;
      }

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limitInt,
          skip: skip,
        }),
      ]);

      return res.json({
        data: logs,
        pagination: {
          total,
          list_total: logs.length,
          page: pageInt,
          totalPages: Math.ceil(total / limitInt),
        },
      });
    },
  ),
});
