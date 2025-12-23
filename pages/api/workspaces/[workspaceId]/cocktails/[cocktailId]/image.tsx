import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.COCKTAILS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const result = await prisma.cocktailRecipeImage.findFirst({
      where: {
        cocktailRecipeId: cocktailId,
        cocktailRecipe: {
          workspaceId: workspace.id,
        },
      },
      select: {
        image: true,
      },
    });

    if (result?.image == null) return res.status(404).json({ message: 'No cocktail image found' });

    const type = result.image.split(';')[0].split(':')[1];
    const decoded = result.image.split(',')[1];
    const imageResp = Buffer.from(decoded, 'base64');

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': imageResp.length,
    });
    return res.send(imageResp);
  }),
});
