import { Prisma } from '@generated/prisma/client';

export type CocktailRecipeGarnishFull = Prisma.CocktailRecipeGarnishGetPayload<{
  include: {
    garnish: true;
  };
}>;
