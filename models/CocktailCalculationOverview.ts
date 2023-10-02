import { Prisma } from '@prisma/client';

export type CocktailCalculationOverview = Prisma.CocktailCalculationGetPayload<{
  include: {
    updatedByUser: true;
    cocktailCalculationItems: {
      include: {
        cocktail: true;
      };
    };
  };
}>;
