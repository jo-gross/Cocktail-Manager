import { Prisma } from '@prisma/client';

export type CocktailRecipeGarnishFull = Prisma.CocktailRecipeGarnishGetPayload<{
  include: {
    garnish: true;
  };
}>;
