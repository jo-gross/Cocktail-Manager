import { Prisma } from '@prisma/client';

export type CocktailRecipeFull = Prisma.CocktailRecipeGetPayload<{
  include: {
    _count: { select: { CocktailRecipeImage: true } };
    glass: { include: { _count: { select: { GlassImage: true } } } };
    garnishes: {
      include: {
        garnish: { include: { _count: { select: { GarnishImage: true } } } };
      };
    };
    steps: {
      include: {
        action: true;
        ingredients: {
          include: {
            ingredient: {
              include: { _count: { select: { IngredientImage: true } } };
            };
            unit: true;
          };
        };
      };
    };
  };
}>;
