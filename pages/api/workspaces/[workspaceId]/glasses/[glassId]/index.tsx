import prisma from '../../../../../../prisma/prisma';
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

    const result = await prisma.glass.delete({
      where: {
        id: glassId,
        workspaceId: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.GLASSES_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const { name, image, deposit, volume } = req.body;
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
    const result = await prisma.glass.update({
      where: {
        id: glassId,
      },
      data: input,
    });

    await prisma.glassImage.deleteMany({
      where: {
        glassId: glassId,
      },
    });
    if (image) {
      await prisma.glassImage.create({
        data: {
          glassId: glassId,
          image: image,
        },
      });
    }

    return res.json({ data: result });
  }),
});
