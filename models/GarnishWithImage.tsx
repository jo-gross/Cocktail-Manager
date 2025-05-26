import { Prisma } from '@generated/prisma/client';

export type GarnishWithImage = Prisma.GarnishGetPayload<{
  include: {
    GarnishImage: {
      select: {
        image: true;
      };
    };
  };
}>;
