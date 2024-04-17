import { Prisma } from '@prisma/client';

export type IngredientModel = Prisma.IngredientGetPayload<{
  include: {
    IngredientVolume: { include: { unit: true } };
    _count: { select: { IngredientImage: true } };
  };
}>;
