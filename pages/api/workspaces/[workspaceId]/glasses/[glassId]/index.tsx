import prisma from '../../../../../../prisma/prisma';
import { createLog } from '../../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import GlassUpdateInput = Prisma.GlassUpdateInput;

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GLASSES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const result = await prisma.glass.findUnique({
      where: {
        id: glassId,
        workspaceId: workspace.id,
      },
      include: {
        GlassImage: {
          select: {
            image: true,
          },
        },
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], Permission.GLASSES_DELETE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    // Prüfe, ob das Glas noch in Cocktail-Rezepten verwendet wird
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: {
        glassId: glassId,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Wenn noch Referenzen existieren, Fehler zurückgeben
    if (cocktails.length > 0) {
      return res.status(409).json({
        message: `Das Glas wird noch in ${cocktails.length} Cocktail(s) verwendet und kann nicht gelöscht werden.`,
        cocktails: cocktails,
      });
    }

    await prisma.$transaction(async (tx) => {
      const oldGlass = await tx.glass.findUnique({
        where: { id: glassId },
        include: { GlassImage: true },
      });

      await tx.glass.delete({
        where: {
          id: glassId,
          workspaceId: workspace.id,
        },
      });

      await createLog(tx, workspace.id, user.id, 'Glass', glassId, 'DELETE', oldGlass, null);
    });

    return res.json({ data: { count: 1 } });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.GLASSES_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const { name, image, deposit, volume } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const oldGlass = await tx.glass.findUnique({
        where: { id: glassId },
        include: { GlassImage: true },
      });

      const input: GlassUpdateInput = {
        id: glassId,
        name: name,
        volume: volume,
        deposit: deposit,
        workspace: {
          connect: {
            id: workspace.id,
          },
        },
      };

      const updatedGlass = await tx.glass.update({
        where: {
          id: glassId,
        },
        data: input,
      });

      await tx.glassImage.deleteMany({
        where: {
          glassId: glassId,
        },
      });

      if (image) {
        await tx.glassImage.create({
          data: {
            glassId: glassId,
            image: image,
          },
        });
      }

      const fullNewGlass = await tx.glass.findUnique({
        where: { id: glassId },
        include: { GlassImage: true },
      });

      await createLog(tx, workspace.id, user.id, 'Glass', glassId, 'UPDATE', oldGlass, fullNewGlass);

      return updatedGlass;
    });

    return res.json({ data: result });
  }),
});
