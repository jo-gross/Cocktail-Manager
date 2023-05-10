// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import CocktailRecipeCreateInput = Prisma.CocktailRecipeCreateInput;

export default async function handle(req, res) {
  const {
    id,
    name,
    description,
    tags,
    price,
    glassWithIce,
    image,
    glassId,
    decorationId,
    steps
  } = req.body;

  const input: CocktailRecipeCreateInput = {
    id: id,
    name: name,
    description: description,
    tags: tags,
    price: price,
    glassWithIce: glassWithIce,
    image: image ?? null,
    glass: { connect: { id: glassId } },
    decoration: decorationId == undefined ? undefined : { connect: { id: decorationId } }
  };

  if(id != undefined) {
    await prisma.cocktailRecipeIngredient.deleteMany({
      where: {
        cocktailRecipeStep: {
          cocktailRecipe: {
            id: id
          }
        }
      }
    });

    await prisma.cocktailRecipeStep.deleteMany({
      where: {
        cocktailRecipe: {
          id: id
        }
      }
    })
  }

  let result;
  if (req.method === "PUT") {
    result = await prisma.cocktailRecipe.update({
      where: {
        id: id
      },
      data: input
    });
  } else if (req.method === "POST") {
    result = await prisma.cocktailRecipe.create({
      data: input
    });
  }

  if (steps.length > 0) {
    await steps.forEach(async (step) => {

      const cocktailRecipeStep = await prisma.cocktailRecipeStep.create({
        data: {
          mixing: step.mixing,
          tool: step.tool,
          stepNumber: step.stepNumber,
          cocktailRecipe: { connect: { id: result.id } }
        }
      });

      await step.ingredients.map(async (ingredient) => {
        await prisma.cocktailRecipeIngredient.create({
          data: {
            id: ingredient.id,
            amount: ingredient.amount,
            ingredientNumber: ingredient.ingredientNumber,
            unit: ingredient.unit,
            cocktailRecipeStepId: cocktailRecipeStep.id,
            ingredientId: ingredient.ingredientId
          }
        });
      });
    });
  }

  return res.json(result);
}
