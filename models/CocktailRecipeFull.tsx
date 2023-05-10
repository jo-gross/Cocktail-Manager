import { Prisma } from "@prisma/client";

export type CocktailRecipeFull = Prisma.CocktailRecipeGetPayload<{
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
  };
}>;
