import { CocktailRecipe, Prisma } from '@prisma/client';
import { CocktailCardFull } from './CocktailCardFull';
import { CocktailRecipeStepFull } from './CocktailRecipeStepFull';

export interface CocktailRecipeFullSchema extends CocktailRecipeFull {
  steps: CocktailRecipeStepFull[];
}

export type CocktailRecipeFull = Prisma.CocktailRecipeGetPayload<{
  include: {
    glass: true;
    garnish: true;
    steps: {
      include: {
        ingredients: {
          include: {
            ingredient: true;
          };
        };
      };
    };
  };
}>;
