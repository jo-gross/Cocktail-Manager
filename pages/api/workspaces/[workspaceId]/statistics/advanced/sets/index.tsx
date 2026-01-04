import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, SavedSetType, SavedSetLogic } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { type, types } = req.query;

    const where: any = {
      workspaceId: workspace.id,
    };

    if (type) {
      // Single type filter
      where.type = type as SavedSetType;
    } else if (types) {
      // Multiple types filter (comma-separated)
      const typeList = (types as string).split(',').filter((t) => Object.values(SavedSetType).includes(t as SavedSetType));
      if (typeList.length > 0) {
        where.type = { in: typeList as SavedSetType[] };
      }
    }

    const sets = await prisma.statisticSavedSet.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({ data: sets });
  }),

  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, type, logic, items } = req.body;

    if (!name || !type || !items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'name, type, and items (array) are required' });
    }

    if (!Object.values(SavedSetType).includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (logic && !Object.values(SavedSetLogic).includes(logic)) {
      return res.status(400).json({ message: 'Invalid logic' });
    }

    const set = await prisma.statisticSavedSet.create({
      data: {
        workspaceId: workspace.id,
        name,
        type: type as SavedSetType,
        logic: logic ? (logic as SavedSetLogic) : null,
        items: items,
      },
    });

    return res.json({ data: set });
  }),

  [HTTPMethod.PUT]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { id, name, logic, items } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    // Verify set belongs to workspace
    const existingSet = await prisma.statisticSavedSet.findFirst({
      where: {
        id,
        workspaceId: workspace.id,
      },
    });

    if (!existingSet) {
      return res.status(404).json({ message: 'Set not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (logic !== undefined) updateData.logic = logic ? (logic as SavedSetLogic) : null;
    if (items !== undefined) updateData.items = items;

    const set = await prisma.statisticSavedSet.update({
      where: { id },
      data: updateData,
    });

    return res.json({ data: set });
  }),

  [HTTPMethod.DELETE]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    // Verify set belongs to workspace
    const existingSet = await prisma.statisticSavedSet.findFirst({
      where: {
        id: id as string,
        workspaceId: workspace.id,
      },
    });

    if (!existingSet) {
      return res.status(404).json({ message: 'Set not found' });
    }

    await prisma.statisticSavedSet.delete({
      where: { id: id as string },
    });

    return res.json({ message: 'Set deleted' });
  }),
});
