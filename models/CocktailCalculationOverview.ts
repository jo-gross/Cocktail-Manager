import { Prisma } from '@generated/prisma/client';

export type CocktailCalculationOverview = Prisma.CocktailCalculationGetPayload<{
  include: {
    group: true;
    updatedByUser: true;
    cocktailCalculationItems: {
      include: {
        cocktail: true;
      };
    };
  };
}> & {
  updatedAt: Date;
};
