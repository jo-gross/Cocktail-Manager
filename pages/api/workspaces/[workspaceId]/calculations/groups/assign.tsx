import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.USER],
    Permission.CALCULATIONS_UPDATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { calculationIds, groupId } = req.body as { calculationIds?: string[]; groupId?: string | null };

      if (!calculationIds || calculationIds.length === 0) {
        return res.status(400).json({ message: 'Keine Kalkulationen ausgewählt' });
      }

      if (groupId) {
        const group = await prisma.cocktailCalculationGroup.findFirst({
          where: { id: groupId, workspaceId: workspace.id },
        });
        if (!group) return res.status(404).json({ message: 'Gruppe nicht gefunden' });
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
