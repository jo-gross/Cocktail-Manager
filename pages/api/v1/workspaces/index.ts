import { NextApiRequest, NextApiResponse } from 'next';
import { Role, User } from '@generated/prisma/client';
import { z } from 'zod';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { sendFail, sendOk } from '@lib/http/responses';
import { WorkspaceNameSchema } from '@lib/schemas/workspace';
import { createWorkspace } from '@lib/templates/createWorkspace';
import { TemplateLocaleSchema } from '@lib/templates/manifest';
import { assertFreeWorkspaceAvailable } from '@lib/entitlements/guards';
import prisma from '../../../../prisma/prisma';

/** `locale`: primary content language (optional, the setup assistant can change it later). */
const WorkspaceCreateSchema = z.object({ name: WorkspaceNameSchema, locale: TemplateLocaleSchema.optional() });

/** Slim list item (lib/network/workspaces.ts `WorkspaceListItem`) — no other members' data. */
const listItemSelect = { id: true, name: true, description: true, image: true } as const;

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    if (process.env.DISABLE_WORKSPACE_CREATION === 'true') {
      return sendFail(res, 403, 'WORKSPACE_CREATION_DISABLED', 'Workspace-Erstellung ist deaktiviert');
    }

    if (!user.email) {
      return sendFail(res, 403, 'DEMO_USER', 'Demo-User können keine Workspaces erstellen');
    }

    const parsed = WorkspaceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request body', parsed.error.issues);
    }

    // Errors are answered with a clean 500 envelope by withHttpMethods.
    const result = await createWorkspace({
      name: parsed.data.name,
      owner: { userId: user.id, role: Role.OWNER },
      locale: parsed.data.locale,
      // Plan limit `freeWorkspacesPerOwner` (hosted instances); 402 PLAN_LIMIT_REACHED.
      guard: (tx) => assertFreeWorkspaceAvailable(tx, user.id),
    });

    return sendOk(res, { id: result.id, name: result.name, description: result.description, image: result.image });
  }),
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const memberships = await prisma.workspaceUser.findMany({
      where: { userId: user.id },
      select: { lastOpened: true, workspace: { select: listItemSelect } },
    });

    const sorted = memberships.sort((a, b) => (b.lastOpened?.getTime() ?? 0) - (a.lastOpened?.getTime() ?? 0)).map((membership) => membership.workspace);

    return sendOk(res, sorted);
  }),
});
