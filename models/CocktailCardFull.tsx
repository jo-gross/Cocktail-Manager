import { Prisma } from '@generated/prisma/client';

export type CocktailCardFull = Prisma.CocktailCardGetPayload<{
  include: {
    groups: {
      include: {
        items: true;
      };
    };
  };
}>;
