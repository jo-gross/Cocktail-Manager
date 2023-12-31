import { Prisma } from '@prisma/client';
import { CocktailRecipeStepFull } from './CocktailRecipeStepFull';

export interface CocktailRecipeFullSchema extends CocktailRecipeFull {
  steps: CocktailRecipeStepFull[];
}

export type CocktailRecipeFull = Prisma.CocktailRecipeGetPayload<{
  include: {
    glass: true;
    garnishes: {
      include: {
        garnish: true;
      };
    };
    steps: {
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                CustomIngredientUnitConversion: true;
              };
            };
          };
        };
      };
    };
  };
}>;
