import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { CocktailRecipeStepFull } from '../../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../../models/CocktailRecipeGarnishFull';
import { createCocktailRecipeAuditLog } from '../../../../../../lib/auditLog';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.COCKTAILS_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const cocktailId = req.query.cocktailId as string | undefined;
      if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });
      const { name } = req.body;

      return prisma.$transaction(async (transaction) => {
        const existing = await transaction.cocktailRecipe.findFirst({
          where: {
            id: cocktailId,
            workspaceId: workspace.id,
          },
          include: {
            ice: true,
            glass: true,
            CocktailRecipeImage: {
              select: {
                image: true,
              },
            },
            garnishes: {
              include: {
                garnish: true,
              },
            },
            steps: {
              include: {
                action: true,
                ingredients: {
                  include: {
                    ingredient: true,
                    unit: true,
                  },
                },
              },
            },
          },
        });

        if (!existing) return res.status(404).json({ message: 'Cocktail not found' });

        // Erstelle den neuen Cocktail
        const createData: any = {
          name: name,
          description: existing.description,
          notes: existing.notes,
          history: existing.history,
          tags: existing.tags,
          price: existing.price,
          workspace: { connect: { id: workspace.id } },
        };

        if (existing.iceId) {
          createData.ice = { connect: { id: existing.iceId } };
        }

        if (existing.glassId) {
          createData.glass = { connect: { id: existing.glassId } };
        }

        const createClone = await transaction.cocktailRecipe.create({
          data: createData,
        });

        // Kopiere das Bild
        if (existing.CocktailRecipeImage && existing.CocktailRecipeImage.length > 0) {
          await transaction.cocktailRecipeImage.create({
            data: {
              image: existing.CocktailRecipeImage[0].image,
              cocktailRecipe: { connect: { id: createClone.id } },
            },
          });
        }

        // Kopiere die Steps mit Ingredients
        if (existing.steps && existing.steps.length > 0) {
          const sortedSteps = [...existing.steps].sort((a, b) => a.stepNumber - b.stepNumber);
          for (const step of sortedSteps) {
            await transaction.cocktailRecipeStep.create({
              data: {
                action: { connect: { id: step.actionId } },
                stepNumber: step.stepNumber,
                optional: step.optional,
                cocktailRecipe: { connect: { id: createClone.id } },
                ingredients: {
                  create: step.ingredients.map((stepIngredient) => {
                    return {
                      amount: stepIngredient.amount,
                      optional: stepIngredient.optional,
                      ingredientNumber: stepIngredient.ingredientNumber,
                      unit: { connect: { id: stepIngredient.unitId } },
                      ingredient: { connect: { id: stepIngredient.ingredientId } },
                    };
                  }),
                },
              },
            });
          }
        }

        // Kopiere die Garnishes
        if (existing.garnishes && existing.garnishes.length > 0) {
          for (const garnish of existing.garnishes) {
            await transaction.cocktailRecipeGarnish.create({
              data: {
                cocktailRecipe: { connect: { id: createClone.id } },
                garnish: { connect: { id: garnish.garnishId } },
                garnishNumber: garnish.garnishNumber,
                description: garnish.description,
                optional: garnish.optional,
              },
            });
          }
        }

        // Fetch the full cloned cocktail for audit log
        const fullClone = await transaction.cocktailRecipe.findUnique({
          where: { id: createClone.id },
          include: {
            ice: true,
            glass: true,
            garnishes: { include: { garnish: true } },
            steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
            CocktailRecipeImage: true,
          },
        });

        await createCocktailRecipeAuditLog(transaction, workspace.id, user.id, createClone.id, 'CREATE', null, fullClone);

        return res.json({ data: createClone });
      });
    },
  ),
});
