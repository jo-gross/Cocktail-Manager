import { Prisma } from '@prisma/client';

export type CocktailCardFull = Prisma.CocktailCardGetPayload<{
  include: {
    groups: {
      include: {
        items: {
          include: {
            cocktail: {
              include: {
                glass: { include: { _count: { select: { GlassImage: true } } } };
                garnishes: {
                  include: {
                    garnish: { include: { _count: { select: { GarnishImage: true } } } };
                  };
                };
                _count: { select: { CocktailRecipeImage: true } };
                steps: {
                  include: {
                    action: true;
                    ingredients: {
                      include: {
                        ingredient: { include: { _count: { select: { IngredientImage: true } } } };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;
