import { Prisma } from '@prisma/client';

export type WorkspaceFull = Prisma.WorkspaceGetPayload<{
  include: {
    WorkspaceSetting: true;
  };
}>;
