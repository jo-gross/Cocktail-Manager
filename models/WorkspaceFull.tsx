import { Prisma } from '@generated/prisma/client';

export type WorkspaceFull = Prisma.WorkspaceGetPayload<{
  include: {
    WorkspaceSetting: true;
  };
}>;
