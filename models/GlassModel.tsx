import { Prisma } from '@prisma/client';

export type GlassModel = Prisma.GlassGetPayload<{
  include: {
    _count: { select: { GlassImage: true } };
  };
}>;
