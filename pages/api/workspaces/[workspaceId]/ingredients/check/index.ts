import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Ingredient, Role, Workspace, Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { calculateIngredientSimilarity } from '@lib/findSimilarEntities';
import levenshtein from 'js-levenshtein';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.INGREDIENTS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const { name, link } = req.query;
        const allIngredients = await transaction.ingredient.findMany({
          where: {
            workspaceId: workspace.id,
          },
        });

        if (typeof name === 'string') {
          if (name.length < 3) {
            return res.status(200).json({ data: null });
          }

          let similarProduct: Ingredient | undefined = undefined;
          let maxSimilarity = 0;

          for (const ingredient of allIngredients) {
            const similarity = calculateIngredientSimilarity(name, ingredient);

            if (similarity > maxSimilarity) {
              maxSimilarity = similarity;
              similarProduct = ingredient;
            }
          }

          if (maxSimilarity > 0.5) {
            // Ähnlichkeitsschwelle anpassen
            return res.status(200).json({ data: similarProduct });
          } else {
            return res.status(200).json({ data: null });
          }
        } else if (typeof link === 'string') {
          const similarProduct = allIngredients
            .filter((ingredient) => ingredient.link != null)
            .find((ingredient) => 1 - levenshtein(ingredient.link!!, link) / Math.max(ingredient.link!!.length, link.length) > 0.8);
          return res.status(200).json({ data: similarProduct });
        } else {
          return res.status(400).json({ msg: 'Invalid query' });
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
