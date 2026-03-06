import { Prisma } from '@generated/prisma/client';

export type GarnishModel = Prisma.GarnishGetPayload<{
  include: {
    _count: { select: { GarnishImage: true } };
  };
}>;
