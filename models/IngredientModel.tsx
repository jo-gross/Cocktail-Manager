import { Prisma } from '@prisma/client';

export type IngredientModel = Prisma.IngredientGetPayload<{
  include: {
    _count: { select: { IngredientImage: true } };
  };
}>;
