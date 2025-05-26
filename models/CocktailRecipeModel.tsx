import { Prisma } from '@generated/prisma/client';

export type CocktailRecipeModel = Prisma.CocktailRecipeGetPayload<{
  include: {
    _count: { select: { CocktailRecipeImage: true } };
    glass: true;
    garnishes: { include: { garnish: true } };
  };
}>;
