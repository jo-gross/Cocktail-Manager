import { Prisma } from '@generated/prisma/client';

export type CocktailRecipeFullWithImage = Prisma.CocktailRecipeGetPayload<{
  include: {
    _count: { select: { CocktailRecipeImage: true } };
    ice: true;
    glass: true;
    CocktailRecipeImage: {
      select: {
        image: true;
      };
    };
    garnishes: {
      include: {
        garnish: true;
      };
    };
    steps: {
      include: {
        action: true;
        ingredients: {
          include: {
            ingredient: true;
            unit: true;
          };
        };
      };
    };
  };
}>;
