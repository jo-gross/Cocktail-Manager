// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { createCocktailRecipeAuditLog } from '../../../../../lib/auditLog';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { NextApiRequest, NextApiResponse } from 'next';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import { CocktailRecipeStepFull } from '../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../models/CocktailRecipeGarnishFull';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { normalizeString } from '../../../../../lib/StringUtils';
import CocktailRecipeCreateInput = Prisma.CocktailRecipeCreateInput;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.COCKTAILS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailRecipes: CocktailRecipeFull[] = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        _count: { select: { CocktailRecipeImage: true } },
        ice: true,
        glass: { include: { _count: { select: { GlassImage: true } } } },
        garnishes: {
          include: {
            garnish: { include: { _count: { select: { GarnishImage: true } } } },
          },
        },
        steps: {
          include: {
            action: true,
            ingredients: {
              include: {
                ingredient: { include: { _count: { select: { IngredientImage: true } } } },
                unit: true,
              },
            },
          },
        },
        ratings: true,
      },
    });
    let searchParam = req.query.search as string | undefined;
    if (searchParam == undefined) {
      return res.json({ data: cocktailRecipes });
    } else {
      const search = normalizeString(searchParam);
      const result = cocktailRecipes.filter(
        (cocktail) =>
          normalizeString(cocktail.name).includes(search) ||
          (cocktail.tags.some((tag) => normalizeString(tag).includes(search)) && search.length >= 3) ||
          (cocktail.garnishes.some((garnish) => normalizeString(garnish.garnish.name).includes(search)) && search.length >= 3) ||
          cocktail.steps.some((step) =>
            step.ingredients
              .filter((ingredient) => ingredient.ingredient?.name != undefined)
              .some(
                (ingredient) =>
                  (normalizeString(ingredient.ingredient?.name).includes(search) && search.length >= 3) ||
                  (normalizeString(ingredient.ingredient?.shortName ?? '').includes(search) && search.length >= 3),
              ),
          ),
      );
      return res.json({ data: result });
    }
  }),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.COCKTAILS_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, description, tags, price, iceId, image, glassId, garnishes = [], steps = [], notes, history } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const input: CocktailRecipeCreateInput = {
          name: name,
          description: description,
          notes: notes,
          history: history,
          tags: tags,
          price: price,
          ice: { connect: { id: iceId } },
          glass: { connect: { id: glassId } },
          workspace: { connect: { id: workspace.id } },
        };

        const createdCocktail = await tx.cocktailRecipe.create({
          data: input,
        });

        if (image) {
          await tx.cocktailRecipeImage.create({
            data: {
              image: image,
              cocktailRecipeId: createdCocktail.id,
            },
          });
        }

        if (steps.length > 0) {
          for (const step of steps as CocktailRecipeStepFull[]) {
            const createdStep = await tx.cocktailRecipeStep.create({
              data: {
                actionId: step.actionId,
                stepNumber: step.stepNumber,
                optional: step.optional,
                cocktailRecipeId: createdCocktail.id,
              },
            });

            const incomingIngredients = (step.ingredients ?? []) as any[];
            for (const ing of incomingIngredients) {
              await tx.cocktailRecipeIngredient.create({
                data: {
                  amount: ing.amount,
                  optional: ing.optional,
                  ingredientNumber: ing.ingredientNumber,
                  unitId: ing.unitId,
                  ingredientId: ing.ingredientId,
                  cocktailRecipeStepId: createdStep.id,
                },
              });
            }
          }
        }

        if (garnishes.length > 0) {
          for (const garnish of garnishes as CocktailRecipeGarnishFull[]) {
            await tx.cocktailRecipeGarnish.create({
              data: {
                cocktailRecipeId: createdCocktail.id,
                garnishId: garnish.garnishId,
                garnishNumber: garnish.garnishNumber,
                description: garnish.description,
                optional: garnish.optional,
                isAlternative: (garnish as any).isAlternative,
              },
            });
          }
        }

        const fullCocktail = await tx.cocktailRecipe.findUnique({
          where: { id: createdCocktail.id },
          include: {
            ice: true,
            glass: true,
            garnishes: { include: { garnish: true } },
            steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
            CocktailRecipeImage: true,
          },
        });

        await createCocktailRecipeAuditLog(tx, workspace.id, user.id, createdCocktail.id, 'CREATE', null, fullCocktail);

        return createdCocktail;
      });

      return res.json({ data: result });
    },
  ),
});
