import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import prisma from '../../../../../prisma/prisma';
import '../../../../../lib/ArrayUtils';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    const cocktailTags = await prisma.cocktailRecipe.findMany({
      where: { workspaceId: workspace.id },
      select: {
        tags: true,
      },
    });

    const ingredientTags = await prisma.ingredient.findMany({
      where: { workspaceId: workspace.id },
      select: {
        tags: true,
      },
    });

    const tags = [...cocktailTags, ...ingredientTags]
      .map((tag) => tag.tags)
      .flat()
      .filterUnique();

    return res.json({ data: tags });
  }),
});
