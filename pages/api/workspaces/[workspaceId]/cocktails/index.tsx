// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { CocktailRecipeStepFull } from '../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../models/CocktailRecipeGarnishFull';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import CocktailRecipeCreateInput = Prisma.CocktailRecipeCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailRecipes: CocktailRecipeFull[] = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        glass: true,
        garnishes: { include: { garnish: true } },
        steps: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });
    let searchParam = req.query.search as string | undefined;
    if (searchParam == undefined) {
      return res.json({ data: cocktailRecipes });
    } else {
      const search = searchParam.trim().toLowerCase();
      const result = cocktailRecipes.filter(
        (cocktail) =>
          cocktail.name.toLowerCase().includes(search) ||
          (cocktail.tags.some((tag) => tag.toLowerCase().includes(search)) && search.length > 3) ||
          (cocktail.garnishes.some((garnish) => garnish.garnish.name.toLowerCase().includes(search)) && search.length > 3) ||
          cocktail.steps.some((step) =>
            step.ingredients
              .filter((ingredient) => ingredient.ingredient?.name != undefined)
              .some(
                (ingredient) =>
                  (ingredient.ingredient?.name.toLowerCase().includes(search) && search.length > 3) ||
                  ((ingredient.ingredient?.shortName ?? '').toLowerCase().includes(search) && search.length > 3),
              ),
          ),
      );
      return res.json({ data: result });
    }
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, description, tags, price, glassWithIce, image, glassId, garnishes, steps } = req.body;

    const input: CocktailRecipeCreateInput = {
      name: name,
      description: description,
      tags: tags,
      price: price,
      glassWithIce: glassWithIce,
      image: image ?? null,
      glass: { connect: { id: glassId } },
      // garnish: garnishId == undefined ? undefined : { connect: { id: garnishId } },
      workspace: { connect: { id: workspace.id } },
    };

    const result = await prisma.cocktailRecipe.create({
      data: input,
    });

    if (steps.length > 0 && result != undefined) {
      await steps.forEach(async (step: CocktailRecipeStepFull) => {
        await prisma.cocktailRecipeStep.create({
          data: {
            mixing: step.mixing,
            tool: step.tool,
            stepNumber: step.stepNumber,
            cocktailRecipe: { connect: { id: result!.id } },
            ingredients: step.mixing
              ? {
                  create: step.ingredients.map((ingredient) => {
                    return {
                      amount: ingredient.amount,
                      ingredientNumber: ingredient.ingredientNumber,
                      unit: ingredient.unit,
                      ingredient: { connect: { id: ingredient.ingredientId } },
                    };
                  }),
                }
              : undefined,
          },
        });
      });
    }
    console.log(garnishes);
    if (garnishes.length > 0 && result != undefined) {
      await garnishes.forEach(async (garnish: CocktailRecipeGarnishFull) => {
        await prisma.cocktailRecipeGarnish.create({
          data: {
            cocktailRecipe: { connect: { id: result!.id } },
            garnish: { connect: { id: garnish.garnishId } },
            garnishNumber: garnish.garnishNumber,
            description: garnish.description,
            optional: garnish.optional,
          },
        });
      });
    }

    return res.json({ data: result });
  }),
});
