import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure } from './backupStructure';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { stripGuestMenuSecrets } from '@lib/backup/backupSecurity';
import { BULK_TX_TIMEOUT_MS, runTx } from '@lib/db/tx';

/**
 * Full workspace export (admins; API keys need BACKUPS_EXPORT). Contains no secrets:
 * the workspace row (signage key), API keys and join codes are not exported and
 * guest menus are stripped of access code and preview token.
 */
/** Reads the whole workspace in one RepeatableRead snapshot so related tables are consistent. */
export async function readWorkspaceBackup(workspaceId: string): Promise<BackupStructure> {
  return runTx(
    async (tx) => {
      const workspaceSettings = await tx.workspaceSetting.findMany({ where: { workspaceId } });
      const cocktailRecipes = await tx.cocktailRecipe.findMany({ where: { workspaceId } });
      const cocktailRecipeIds = cocktailRecipes.map((recipe) => recipe.id);
      const cocktailRecipeSteps = await tx.cocktailRecipeStep.findMany({ where: { cocktailRecipeId: { in: cocktailRecipeIds } } });
      const cards = await tx.cocktailCard.findMany({ where: { workspaceId } });
      const cardGroups = await tx.cocktailCardGroup.findMany({ where: { cocktailCardId: { in: cards.map((card) => card.id) } } });
      const calculations = await tx.cocktailCalculation.findMany({ where: { workspaceId } });
      const calculationGroups = await tx.cocktailCalculationGroup.findMany({ where: { workspaceId } });
      const garnishes = await tx.garnish.findMany({ where: { workspaceId } });
      const ingredients = await tx.ingredient.findMany({ where: { workspaceId } });
      const ingredientIds = ingredients.map((ingredient) => ingredient.id);
      const glasses = await tx.glass.findMany({ where: { workspaceId } });

      return {
        ice: await tx.ice.findMany({ where: { workspaceId } }),
        units: await tx.unit.findMany({ where: { workspaceId } }),
        unitConversions: await tx.unitConversion.findMany({ where: { workspaceId } }),
        workspaceSettings,
        stepActions: await tx.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId } }),
        garnish: garnishes,
        garnishImages: await tx.garnishImage.findMany({ where: { garnishId: { in: garnishes.map((garnish) => garnish.id) } } }),
        ingredient: ingredients,
        ingredientVolumes: await tx.ingredientVolume.findMany({ where: { ingredientId: { in: ingredientIds } } }),
        ingredientImages: await tx.ingredientImage.findMany({ where: { ingredientId: { in: ingredientIds } } }),
        glass: glasses,
        glassImages: await tx.glassImage.findMany({ where: { glassId: { in: glasses.map((glass) => glass.id) } } }),
        cocktailRecipe: cocktailRecipes,
        cocktailRecipeImage: await tx.cocktailRecipeImage.findMany({ where: { cocktailRecipeId: { in: cocktailRecipeIds } } }),
        cocktailRecipeStep: cocktailRecipeSteps,
        cocktailRecipeGarnish: await tx.cocktailRecipeGarnish.findMany({ where: { cocktailRecipeId: { in: cocktailRecipeIds } } }),
        cocktailRecipeIngredient: await tx.cocktailRecipeIngredient.findMany({
          where: { cocktailRecipeStepId: { in: cocktailRecipeSteps.map((step) => step.id) } },
        }),
        cocktailCard: cards,
        cocktailCardGroup: cardGroups,
        cocktailCardGroupItem: await tx.cocktailCardGroupItem.findMany({ where: { cocktailCardGroupId: { in: cardGroups.map((group) => group.id) } } }),
        calculation: calculations,
        calculationGroups,
        calculationItems: await tx.cocktailCalculationItems.findMany({
          where: { calculationId: { in: calculations.map((calculation) => calculation.id) } },
        }),
        signage: await tx.signage.findMany({ where: { workspaceId } }),
        signageSlides: await tx.signageSlide.findMany({ where: { workspaceId }, orderBy: [{ format: 'asc' }, { order: 'asc' }] }),
        tagCategories: await tx.tagCategory.findMany({ where: { workspaceId }, orderBy: { order: 'asc' } }),
        tagDefinitions: await tx.tagDefinition.findMany({ where: { workspaceId } }),
        cocktailRecipeTranslations: await tx.cocktailRecipeTranslation.findMany({ where: { cocktail: { workspaceId } } }),
        ingredientTranslations: await tx.ingredientTranslation.findMany({ where: { ingredient: { workspaceId } } }),
        garnishTranslations: await tx.garnishTranslation.findMany({ where: { garnish: { workspaceId } } }),
        glassTranslations: await tx.glassTranslation.findMany({ where: { glass: { workspaceId } } }),
        guestMenus: (await tx.guestMenu.findMany({ where: { workspaceId }, orderBy: { priority: 'asc' } })).map(stripGuestMenuSecrets),
        guestMenuTemplates: await tx.guestMenuTemplate.findMany({ where: { workspaceId } }),
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: BULK_TX_TIMEOUT_MS },
  );
}

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.ADMIN], Permission.BACKUPS_EXPORT, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const backup = await readWorkspaceBackup(workspace.id);
    console.info(`[BackupExport][${workspace.id}] Export finished`, {
      cocktails: backup.cocktailRecipe.length,
      ingredients: backup.ingredient.length,
      calculations: backup.calculation.length,
      signageSlides: backup.signageSlides?.length ?? 0,
      guestMenus: backup.guestMenus?.length ?? 0,
    });
    return res.json(backup);
  }),
});
