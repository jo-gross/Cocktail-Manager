// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import GarnishCreateInput = Prisma.GarnishCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GARNISHES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const where: Prisma.GarnishWhereInput = {
      workspaceId: workspace.id,
    };
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    const garnishes = await prisma.garnish.findMany({
      where,
      include: {
        _count: { select: { GarnishImage: true } },
      },
    });
    return res.json({ data: garnishes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.GARNISHES_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, price, id, image, description, notes } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const input: GarnishCreateInput = {
          id: id,
          name: name,
          price: price,
          description: description,
          notes: notes,
          workspace: {
            connect: {
              id: workspace.id,
            },
          },
        };

        const createdGarnish = await tx.garnish.create({
          data: input,
        });

        if (image) {
          await tx.garnishImage.create({
            data: {
              image: image,
              garnish: {
                connect: {
                  id: createdGarnish.id,
                },
              },
            },
          });
        }

        const fullGarnish = await tx.garnish.findUnique({
          where: { id: createdGarnish.id },
          include: { GarnishImage: true },
        });

        await createLog(tx, workspace.id, user.id, 'Garnish', createdGarnish.id, 'CREATE', null, fullGarnish);

        return createdGarnish;
      });

      return res.json({ data: result });
    },
  ),
});
