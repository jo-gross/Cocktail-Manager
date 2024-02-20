import { Prisma } from '@prisma/client';

export type GarnishModel = Prisma.GarnishGetPayload<{
  include: {
    _count: { select: { GarnishImage: true } };
  };
}>;
