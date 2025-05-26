import { Prisma } from '@generated/prisma/client';

export type IngredientWithImage = Prisma.IngredientGetPayload<{
  include: {
    IngredientVolume: {
      include: {
        unit: true;
      };
    };
    IngredientImage: {
      select: {
        image: true;
      };
    };
  };
}>;
