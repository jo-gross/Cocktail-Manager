import { Prisma } from '@generated/prisma/client';

export type GlassModel = Prisma.GlassGetPayload<{
  include: {
    _count: { select: { GlassImage: true } };
  };
}>;
