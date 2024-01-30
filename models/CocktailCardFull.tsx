import { Prisma } from '@prisma/client';

export type CocktailCardFull = Prisma.CocktailCardGetPayload<{
  include: {
    groups: {
      include: {
        items: {
          include: {
            cocktail: {
              include: {
                glass: true;
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
