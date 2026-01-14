import prisma from '../../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Permission, Role, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../../lib/DateUtils';
import { getEndOfDay, getStartOfDay } from '../../../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, startDate, endDate, page, limit, search } = req.query;

    if (!cocktailId) {
      return res.status(400).json({ message: 'cocktailId is required' });
    }

    // Verify cocktail exists and belongs to workspace
    const cocktail = await prisma.cocktailRecipe.findFirst({
      where: {
        id: cocktailId as string,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!cocktail) {
      return res.status(404).json({ message: 'Cocktail not found' });
    }

    // Load workspace day start time setting
    const dayStartTimeSetting = await prisma.workspaceSetting.findUnique({
      where: {
        workspaceId_setting: {
          workspaceId: workspace.id,
          setting: WorkspaceSettingKey.statisticDayStartTime,
        },
      },
    });
    const dayStartTime = dayStartTimeSetting?.value || undefined;

    // Parse pagination parameters
    const pageNumber = page ? parseInt(page as string, 10) : 1;
    const pageSize = limit ? parseInt(limit as string, 10) : 50;
    const skip = (pageNumber - 1) * pageSize;
    const take = pageSize;

    // Build where clause
    const where: any = {
      workspaceId: workspace.id,
      cocktailId: cocktailId as string,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = getStartOfDay(new Date(startDate as string), dayStartTime);
      }
      if (endDate) {
        where.date.lte = getEndOfDay(new Date(endDate as string), dayStartTime);
      }
    }

    // Get all results first (we'll filter client-side for search)
    // This is simpler and more reliable than complex Prisma queries with nullable relations
    const allOrders = await prisma.cocktailStatisticItem.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        cocktailCard: {
          select: {
            name: true,
          },
        },
      },
    });

    // Helper function to format date with weekday (e.g., "Mo. 17.01.25")
    const formatDateWithWeekday = (date: Date): string => {
      const weekdays = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
      const weekday = weekdays[date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${weekday} ${day}.${month}.${year}`;
    };

    // Format orders with date and time
    let formattedOrders = allOrders.map((order) => {
      const orderDate = new Date(order.date);
      return {
        id: order.id,
        date: order.date,
        dateFormatted: formatDateWithWeekday(orderDate),
        dateFormattedShort: `${orderDate.getDate()}.${(orderDate.getMonth() + 1).toString().padStart(2, '0')}.`,
        weekday: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][orderDate.getDay()],
        user: order.user ? { name: order.user.name, email: order.user.email } : null,
        cocktailCard: order.cocktailCard ? { name: order.cocktailCard.name } : null,
      };
    });

    // Apply search filter if provided (client-side filtering)
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      formattedOrders = formattedOrders.filter((order) => {
        // Search in formatted date string (e.g., "Mo. 17.01.25")
        const dateFormattedStr = order.dateFormatted.toLowerCase();
        // Search in short date format (e.g., "17.01.")
        const dateShortStr = order.dateFormattedShort.toLowerCase();
        // Search in weekday (e.g., "Mo", "Mo.")
        const weekdayStr = order.weekday.toLowerCase();
        // Search in full date string
        const dateFullStr = new Date(order.date).toLocaleString('de-DE').toLowerCase();
        // Search in user info
        const userStr = order.user ? `${order.user.name} ${order.user.email || ''}`.toLowerCase() : '';
        // Search in card name
        const cardStr = order.cocktailCard ? order.cocktailCard.name.toLowerCase() : '';
        return (
          dateFormattedStr.includes(searchLower) ||
          dateShortStr.includes(searchLower) ||
          weekdayStr.includes(searchLower) ||
          dateFullStr.includes(searchLower) ||
          userStr.includes(searchLower) ||
          cardStr.includes(searchLower)
        );
      });
    }

    // Get total count after filtering
    const finalTotal = formattedOrders.length;

    // Apply pagination to filtered results
    const paginatedOrders = formattedOrders.slice(skip, skip + take);

    // Remove helper fields before sending to client
    const ordersToSend = paginatedOrders.map((order) => ({
      id: order.id,
      date: order.date,
      user: order.user,
      cocktailCard: order.cocktailCard,
    }));

    return res.json({
      data: ordersToSend,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / pageSize),
      },
    });
  }),
});
