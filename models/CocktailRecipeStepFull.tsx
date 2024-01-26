import { Prisma } from '@prisma/client';

export type CocktailRecipeStepFull = Prisma.CocktailRecipeStepGetPayload<{
  include: {
    action: true;
    ingredients: {
      include: {
        ingredient: true;
      };
    };
  };
}>;
