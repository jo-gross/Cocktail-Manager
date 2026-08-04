// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { updateTranslation } from '../admin/translation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.ICE_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const where: Prisma.IceWhereInput = {
      workspaceId: workspace.id,
    };
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    const ice = await prisma.ice.findMany({
      where,
    });
    return res.json({ data: ice });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], Permission.ICE_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, translations } = req.body;

    const result = await prisma.ice.create({
      data: {
        name: name,
        workspace: {
          connect: {
            id: workspace.id,
          },
        },
      },
    });

    if (translations) {
      await updateTranslation(workspace.id, name, translations);
    }

    return res.json({ data: result });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/ice' }, legacyHandler);
