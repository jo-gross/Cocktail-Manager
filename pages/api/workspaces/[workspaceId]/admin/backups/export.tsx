import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../lib/prisma';
import { BackupStructure } from './backupStructure';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;

  if (req.method === 'GET') {
    const cocktailRecipes = await prisma.cocktailRecipe.findMany({ where: { workspaceId } });
    const cocktailRecipeSteps = await prisma.cocktailRecipeStep.findMany({
      where: {
        cocktailRecipeId: {
          in: cocktailRecipes.map((recipe) => recipe.id),
        },
      },
    });

    const cards = await prisma.cocktailCard.findMany({ where: { workspaceId } });
    const cardGroups = await prisma.cocktailCardGroup.findMany({
      where: {
        cocktailCardId: {
          in: cards.map((card) => card.id),
        },
      },
    });

    const calculations = await prisma.cocktailCalculation.findMany({ where: { workspaceId } });

    const backup: BackupStructure = {
      garnish: await prisma.garnish.findMany({ where: { workspaceId } }),
      ingredient: await prisma.ingredient.findMany({ where: { workspaceId } }),
      glass: await prisma.glass.findMany({ where: { workspaceId } }),
      cocktailRecipe: cocktailRecipes,
      cocktailRecipeStep: cocktailRecipeSteps,
      cocktailRecipeGarnish: await prisma.cocktailRecipeGarnish.findMany({
        where: {
          cocktailRecipeId: {
            in: cocktailRecipes.map((recipe) => recipe.id),
          },
        },
      }),
      cocktailRecipeIngredient: await prisma.cocktailRecipeIngredient.findMany({
        where: {
          cocktailRecipeStepId: {
            in: cocktailRecipeSteps.map((step) => step.id),
          },
        },
      }),
      cocktailCard: cards,
      cocktailCardGroup: cardGroups,
      cocktailCardGroupItem: await prisma.cocktailCardGroupItem.findMany({
        where: {
          cocktailCardGroupId: {
            in: cardGroups.map((group) => group.id),
          },
        },
      }),
      calculation: calculations,
      calculationItems: await prisma.cocktailCalculationItems.findMany({
        where: {
          calculationId: {
            in: calculations.map((calculation) => calculation.id),
          },
        },
      }),
    };

    return res.json(backup);
  }
  return res.status(405).json({ msg: 'Method not implemented' });
}
