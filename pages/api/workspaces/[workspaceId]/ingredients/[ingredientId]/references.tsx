import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role, Workspace } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    Permission.INGREDIENTS_READ,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
      const ingredientId = req.query.ingredientId as string | undefined;
      if (!ingredientId) return res.status(400).json({ message: 'No ingredient id' });

      // Prüfe, ob die Zutat noch in Cocktail-Rezepten verwendet wird
      const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.findMany({
        where: {
          ingredientId: ingredientId,
        },
        include: {
          cocktailRecipeStep: {
            include: {
              cocktailRecipe: {
                select: {
                  id: true,
                  name: true,
                  workspaceId: true,
                },
              },
            },
          },
        },
      });

      // Extrahiere eindeutige Cocktails (könnte mehrere Referenzen pro Cocktail geben)
      const uniqueCocktails = new Map<string, { id: string; name: string }>();
      cocktailRecipeIngredients.forEach((ingredient) => {
        const cocktail = ingredient.cocktailRecipeStep.cocktailRecipe;
        // Nur Cocktails aus dem gleichen Workspace berücksichtigen
        if (cocktail.workspaceId === workspace.id) {
          uniqueCocktails.set(cocktail.id, { id: cocktail.id, name: cocktail.name });
        }
      });

      const cocktails = Array.from(uniqueCocktails.values());

      return res.json({
        data: {
          inUse: cocktails.length > 0,
          cocktails: cocktails,
        },
      });
    },
  ),
});
