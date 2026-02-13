// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import GlassCreateInput = Prisma.GlassCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GLASSES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const where: Prisma.GlassWhereInput = {
      workspaceId: workspace.id,
    };
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    const glasses = await prisma.glass.findMany({
      where,
      include: {
        _count: { select: { GlassImage: true } },
      },
    });
    return res.json({ data: glasses });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], Permission.GLASSES_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, id, image, deposit, volume } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const input: GlassCreateInput = {
        id: id,
        name: name,
        volume: volume,
        deposit: deposit,
        workspace: {
          connect: {
            id: workspace.id,
          },
        },
      };

      const createdGlass = await tx.glass.create({
        data: input,
      });

      if (image) {
        await tx.glassImage.create({
          data: {
            image: image,
            glass: {
              connect: {
                id: createdGlass.id,
              },
            },
          },
        });
      }

      const fullGlass = await tx.glass.findUnique({
        where: { id: createdGlass.id },
        include: { GlassImage: true },
      });

      await createLog(tx, workspace.id, user.id, 'Glass', createdGlass.id, 'CREATE', null, fullGlass);

      return createdGlass;
    });

    return res.json({ data: result });
  }),
});
