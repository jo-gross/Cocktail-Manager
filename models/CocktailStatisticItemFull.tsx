import { Prisma } from '@prisma/client';

export type CocktailStatisticItemFull = Prisma.CocktailStatisticItemGetPayload<{
  include: {
    cocktail: true;
    user: true;
    cocktailCard: true;
  };
}>;
