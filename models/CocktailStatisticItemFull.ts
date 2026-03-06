import { Prisma } from '@generated/prisma/client';

export type CocktailStatisticItemFull = Prisma.CocktailStatisticItemGetPayload<{
  include: {
    cocktail: true;
    user: true;
    cocktailCard: true;
  };
}>;
