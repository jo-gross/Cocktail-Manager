import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { CocktailExportStructure } from '../../../../../types/CocktailExportStructure';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import packageJson from '../../../../../package.json';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
    },
  },
};

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const workspaceId = workspace.id;
    const { cocktailIds } = req.body as { cocktailIds: string[] };

    if (!cocktailIds || cocktailIds.length === 0) {
      return res.status(400).json({ message: 'Keine Cocktails ausgewählt' });
    }

    try {
      // Fetch selected cocktails
      const cocktailRecipes = await prisma.cocktailRecipe.findMany({
        where: {
          id: { in: cocktailIds },
          workspaceId,
        },
      });

      if (cocktailRecipes.length === 0) {
        return res.status(404).json({ message: 'Keine Cocktails gefunden' });
      }

      // Fetch cocktail recipe images
      const cocktailRecipeImages = await prisma.cocktailRecipeImage.findMany({
        where: {
          cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) },
        },
      });

      // Fetch cocktail recipe steps
      const cocktailRecipeSteps = await prisma.cocktailRecipeStep.findMany({
        where: {
          cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) },
        },
      });

      // Fetch cocktail recipe garnishes
      const cocktailRecipeGarnishes = await prisma.cocktailRecipeGarnish.findMany({
        where: {
          cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) },
        },
      });

      // Fetch cocktail recipe ingredients
      const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.findMany({
        where: {
          cocktailRecipeStepId: { in: cocktailRecipeSteps.map((s) => s.id) },
        },
      });

      // Extract unique dependency IDs
      const glassIds = Array.from(new Set(cocktailRecipes.map((r) => r.glassId).filter(Boolean))) as string[];
      const iceIds = Array.from(new Set(cocktailRecipes.map((r) => r.iceId).filter(Boolean))) as string[];
      const garnishIds = Array.from(new Set(cocktailRecipeGarnishes.map((g) => g.garnishId).filter(Boolean))) as string[];
      const ingredientIds = Array.from(new Set(cocktailRecipeIngredients.map((i) => i.ingredientId).filter(Boolean))) as string[];
      const stepActionIds = Array.from(new Set(cocktailRecipeSteps.map((s) => s.actionId).filter(Boolean))) as string[];

      // Fetch dependencies
      const glasses = await prisma.glass.findMany({
        where: { id: { in: glassIds } },
      });

      const glassImages = await prisma.glassImage.findMany({
        where: { glassId: { in: glassIds } },
      });

      const ice = await prisma.ice.findMany({
        where: { id: { in: iceIds } },
      });

      const garnishes = await prisma.garnish.findMany({
        where: { id: { in: garnishIds } },
      });

      const garnishImages = await prisma.garnishImage.findMany({
        where: { garnishId: { in: garnishIds } },
      });

      const ingredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
      });

      const ingredientImages = await prisma.ingredientImage.findMany({
        where: { ingredientId: { in: ingredientIds } },
      });

      const ingredientVolumes = await prisma.ingredientVolume.findMany({
        where: { ingredientId: { in: ingredientIds } },
      });

      const stepActions = await prisma.workspaceCocktailRecipeStepAction.findMany({
        where: { id: { in: stepActionIds } },
      });

      // Extract unique unit IDs from ingredients and ingredient volumes
      const unitIds = Array.from(
        new Set([...ingredientVolumes.map((v) => v.unitId), ...cocktailRecipeIngredients.map((i) => i.unitId)].filter(Boolean) as string[]),
      );

      const units = await prisma.unit.findMany({
        where: { id: { in: unitIds } },
      });

      // Build export structure
      const exportData: CocktailExportStructure = {
        exportVersion: packageJson.version,
        exportDate: new Date().toISOString(),
        exportedFrom: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        },
        cocktailRecipes,
        cocktailRecipeImages,
        cocktailRecipeSteps,
        cocktailRecipeGarnishes,
        cocktailRecipeIngredients,
        glasses,
        glassImages,
        garnishes,
        garnishImages,
        ingredients,
        ingredientImages,
        ingredientVolumes,
        ice,
        units,
        stepActions,
      };

      return res.json(exportData);
    } catch (error) {
      console.error('Export error:', error);
      return res.status(500).json({ message: 'Fehler beim Exportieren der Cocktails' });
    }
  }),
});
