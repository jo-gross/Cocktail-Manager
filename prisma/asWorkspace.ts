import type { Workspace } from '@generated/prisma/client';

/**
 * Types a workspace row loaded with the global omit (`prisma/prisma.ts`) as `Workspace`
 * (controllers take the generated type). `signageKey` is `undefined` at runtime – never
 * read it from such a row, load it explicitly (`lib/api/controllers/signage.ts`).
 */
export function asWorkspace<T extends Omit<Workspace, 'signageKey'>>(row: T): T & Workspace {
  return row as T & Workspace;
}
