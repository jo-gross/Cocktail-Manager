import { Prisma } from '@prisma/client';

export type IngredientWithImage = Prisma.IngredientGetPayload<{
  include: {
    IngredientImage: {
      select: {
        image: true;
      };
    };
  };
}>;
