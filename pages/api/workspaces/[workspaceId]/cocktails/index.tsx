// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
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
      const { name, description, tags, price, iceId, image, glassId, garnishes, steps, notes, history } = req.body;

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

      const result = await prisma.cocktailRecipe.create({
        data: input,
      });

      if (image) {
        await prisma.cocktailRecipeImage.create({
          data: {
            image: image,
            cocktailRecipe: {
              connect: {
                id: result.id,
              },
            },
          },
        });
      }

      if (steps.length > 0 && result != undefined) {
        await steps.forEach(async (step: CocktailRecipeStepFull) => {
          await prisma.cocktailRecipeStep.create({
            data: {
              action: { connect: { id: step.actionId } },
              stepNumber: step.stepNumber,
              optional: step.optional,
              cocktailRecipe: { connect: { id: result!.id } },
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
        });
      }
      if (garnishes.length > 0 && result != undefined) {
        await garnishes.forEach(async (garnish: CocktailRecipeGarnishFull) => {
          await prisma.cocktailRecipeGarnish.create({
            data: {
              cocktailRecipe: { connect: { id: result!.id } },
              garnish: { connect: { id: garnish.garnishId } },
              garnishNumber: garnish.garnishNumber,
              description: garnish.description,
              optional: garnish.optional,
              isAlternative: (garnish as any).isAlternative,
            },
          });
        });
      }

      return res.json({ data: result });
    },
  ),
});
