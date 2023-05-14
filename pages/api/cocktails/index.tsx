// pages/api/post/index.ts

import prisma from "../../../lib/prisma";
import { Prisma } from ".prisma/client";
import { CocktailRecipeFull } from "../../../models/CocktailRecipeFull";
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

  if (req.method === "GET") {
    const search = req.query.search;
    const cocktailRecipes: CocktailRecipeFull[] = await prisma.cocktailRecipe.findMany({
      include: {
        glass: true,
        decoration: true,
        steps: {
          include: {
            ingredients: {
              include: {
                ingredient: true
              }
            }
          }
        }
      }
    });

    return res.json(cocktailRecipes.filter((cocktail) => search.trim() != "" && (
      cocktail.name.toLowerCase().includes(search.toLowerCase()) ||
      cocktail.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())) ||
      (cocktail.decoration != undefined && cocktail.decoration.name.toLowerCase().includes(search.toLowerCase())) ||
      cocktail.steps.some((step) => step.ingredients.filter(ingredient => ingredient.ingredient.name != undefined).some((ingredient) => ingredient.ingredient.name.toLowerCase().includes(search.toLowerCase()) || (ingredient.ingredient.shortName ?? "").toLowerCase().includes(search.toLowerCase()))))
    ));
  }

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

  if (id != undefined) {
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
    });
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

      await prisma.cocktailRecipeStep.create({
        data: {
          mixing: step.mixing,
          tool: step.tool,
          stepNumber: step.stepNumber,
          cocktailRecipe: { connect: { id: result.id } },
          ingredients: step.mixing ? {
            create: step.ingredients.map((ingredient) => {
                return {
                  amount: ingredient.amount,
                  ingredientNumber: ingredient.ingredientNumber,
                  unit: ingredient.unit,
                  ingredient: { connect: { id: ingredient.ingredientId } }
                };
              }
            )
          } : undefined
        }
      });
    });
  }

  return res.json(result);
}
