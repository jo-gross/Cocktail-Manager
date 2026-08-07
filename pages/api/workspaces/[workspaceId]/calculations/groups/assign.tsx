import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';
import HTTPMethod from 'http-method-enum';

const legacyHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.USER],
    Permission.CALCULATIONS_UPDATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { calculationIds, groupId } = req.body as { calculationIds?: string[]; groupId?: string | null };

      if (!calculationIds || calculationIds.length === 0) {
        return res.status(400).json({ message: 'No calculations selected' });
      }

      if (groupId) {
        const group = await prisma.cocktailCalculationGroup.findFirst({
          where: { id: groupId, workspaceId: workspace.id },
        });
        if (!group) return res.status(404).json({ message: 'Group not found' });
      }

      // Use raw SQL to avoid Prisma @updatedAt side effects on pure group assignment.
      const updatedCount = await prisma.$executeRaw(
        Prisma.sql`
        UPDATE "CocktailCalculation"
        SET "groupId" = ${groupId ?? null}
        WHERE "workspaceId" = ${workspace.id}
          AND "id" IN (${Prisma.join(calculationIds)})
      `,
      );

      return res.json({ data: { updatedCount } });
    },
  ),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/calculations/groups/assign' }, legacyHandler);
