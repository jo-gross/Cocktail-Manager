import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { Prisma, Role } from '@prisma/client';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import { CocktailRecipeStepFull } from '../../../../../../models/CocktailRecipeStepFull';
import { CocktailRecipeGarnishFull } from '../../../../../../models/CocktailRecipeGarnishFull';
import { CocktailRecipeFullWithImage } from '../../../../../../models/CocktailRecipeFullWithImage';
import CocktailRecipeUpdateInput = Prisma.CocktailRecipeUpdateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const result: CocktailRecipeFullWithImage | null = await prisma.cocktailRecipe.findFirst({
      where: {
        id: cocktailId,
        workspaceId: workspace.id,
      },
      include: {
        _count: { select: { CocktailRecipeImage: true } },
        ice: true,
        glass: { include: { _count: { select: { GlassImage: true } } } },
        CocktailRecipeImage: {
          select: {
            image: true,
          },
        },
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
      },
    });

    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const { name, description, tags, price, iceId, image, glassId, garnishes, steps, notes } = req.body;

    const input: CocktailRecipeUpdateInput = {
      name: name,
      description: description,
      notes: notes,
      tags: tags,
      price: price,
      ice: { connect: { id: iceId } },
      glass: { connect: { id: glassId } },
      workspace: { connect: { id: workspace.id } },
    };

    await prisma.cocktailRecipeImage.deleteMany({
      where: {
        cocktailRecipeId: cocktailId,
      },
    });

    if (image != undefined) {
      await prisma.cocktailRecipeImage.create({
        data: {
          cocktailRecipe: { connect: { id: cocktailId } },
          image: image,
        },
      });
    }

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
            action: { connect: { id: step.actionId } },
            stepNumber: step.stepNumber,
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
          },
        });
      });
    }

    return res.json(result);
  }),
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
