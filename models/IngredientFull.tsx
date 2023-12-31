import { Prisma } from '@prisma/client';

export type IngredientFull = Prisma.IngredientGetPayload<{
  include: {
    CustomIngredientUnitConversion: true;
  };
}>;
