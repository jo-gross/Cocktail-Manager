import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { Prisma, Role } from '@prisma/client';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import { CocktailRecipeStepFull } from '../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../models/CocktailRecipeGarnishFull';
import CocktailRecipeUpdateInput = Prisma.CocktailRecipeUpdateInput;

// DELETE /api/cocktails/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const cocktailId = req.query.cocktailId as string | undefined;
      if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

      const result = await prisma.cocktailRecipe.findFirst({
        where: {
          id: cocktailId,
          workspaceId: workspace.id,
        },
        include: {
          glass: true,
          garnishes: {
            include: {
              garnish: true,
            },
          },
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
      return res.json({ data: result });
    },
  ),
  [HTTPMethod.PUT]: withWorkspacePermission(
    [Role.MANAGER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const cocktailId = req.query.cocktailId as string | undefined;
      if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

      const { name, description, tags, price, glassWithIce, image, glassId, garnishes, steps } = req.body;

      const input: CocktailRecipeUpdateInput = {
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

      await prisma.cocktailRecipeIngredient.deleteMany({
        where: {
          cocktailRecipeStep: {
            cocktailRecipe: {
              id: cocktailId,
            },
          },
        },
      });

      await prisma.cocktailRecipeGarnish.deleteMany({
        where: {
          cocktailRecipe: {
            id: cocktailId,
          },
        },
      });

      await prisma.cocktailRecipeStep.deleteMany({
        where: {
          cocktailRecipe: {
            id: cocktailId,
          },
        },
      });

      const result = await prisma.cocktailRecipe.update({
        where: {
          id: cocktailId,
        },
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

      return res.json(result);
    },
  ),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    await prisma.cocktailRecipeIngredient.deleteMany({
      where: {
        cocktailRecipeStep: {
          cocktailRecipeId: cocktailId,
        },
      },
    });
    await prisma.cocktailRecipeStep.deleteMany({
      where: {
        cocktailRecipeId: cocktailId,
      },
    });
    const result = await prisma.cocktailRecipe.delete({
      where: {
        id: cocktailId,
      },
    });
    return res.json({ data: result });
  }),
});
