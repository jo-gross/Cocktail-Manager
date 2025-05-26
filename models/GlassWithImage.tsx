import { Prisma } from '@generated/prisma/client';

export type GlassWithImage = Prisma.GlassGetPayload<{
  include: {
    GlassImage: {
      select: {
        image: true;
      };
    };
  };
}>;
