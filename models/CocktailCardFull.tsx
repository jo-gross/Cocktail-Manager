import { Prisma } from '@prisma/client';

export type CocktailCardFull = Prisma.CocktailCardGetPayload<{
  include: {
    groups: {
      include: {
        items: true;
      };
    };
  };
}>;
