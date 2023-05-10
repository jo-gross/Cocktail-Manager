import { Prisma } from "@prisma/client";

export type CocktailRecipeStepFull = Prisma.CocktailRecipeStepGetPayload<{
  include: {
    ingredients: {
      include: {
        ingredient: true
      }
    }
  };
}>;
