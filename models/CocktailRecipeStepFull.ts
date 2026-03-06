import { Prisma } from '@generated/prisma/client';

export type CocktailRecipeStepFull = Prisma.CocktailRecipeStepGetPayload<{
  include: {
    action: true;
    ingredients: {
      include: {
        unit: true;
        ingredient: true;
      };
    };
  };
}>;
