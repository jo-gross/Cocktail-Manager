import { Prisma } from '@prisma/client';

export type GarnishWithImage = Prisma.GarnishGetPayload<{
  include: {
    GarnishImage: {
      select: {
        image: true;
      };
    };
  };
}>;
