import { Prisma } from "@prisma/client";

export type CocktailCardFull = Prisma.CocktailCardGetPayload<{
  include: {
    groups: {
      include: {
        items: {
          include: {
            cocktail: {
              include: {
                glass: true,
                decoration: true,
                steps: {
                  include: {
                    ingredients: {
                      include: {
                        ingredient: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}>;
