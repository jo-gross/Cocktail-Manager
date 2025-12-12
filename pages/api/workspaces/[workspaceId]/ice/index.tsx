// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { updateTranslation } from '../admin/translation';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.ICE_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const ice = await prisma.ice.findMany({
      where: { workspaceId: workspace.id },
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
