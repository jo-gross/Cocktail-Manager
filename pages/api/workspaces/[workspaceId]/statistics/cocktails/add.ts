import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { StatisticBadRequestMessage } from '../../../../../../models/StatisticBadRequest';
import CocktailStatisticItemCreateInput = Prisma.CocktailStatisticItemCreateInput;

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.STATISTICS_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, cocktailCardId, actionSource, notes, ignoreQueue } = req.body;

    var cardId = cocktailCardId as string | undefined;
    if (cardId == 'search') {
      cardId = undefined;
    }
    const input: CocktailStatisticItemCreateInput = {
      date: new Date(),
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
      user: {
        connect: {
          id: user.id,
        },
      },
      cocktail: {
        connect: {
          id: cocktailId,
        },
      },
      cocktailCard: cardId
        ? {
            connect: {
              id: cardId,
            },
          }
        : undefined,
      actionSource: actionSource,
    };

    if (!ignoreQueue) {
      const items = await prisma.cocktailQueue.findMany({
        where: {
          workspaceId: workspace.id,
          cocktailId: cocktailId,
        },
      });
      // If there are items in the queue, then some could be removed
      if (items.length != 0) {
        /*
        - If notes are provided, the cocktail is removed from the queue. If no cocktail was found - ignore the queue,
        - If no note was provided:
          - if only cocktails with no notes are in the queue, the cocktail gets removed from the queue,
          - if there are cocktails with notes in the queue, return an error "ask user wich one to remove" (oldest
         */
        if (notes) {
          const searchNote: string | null = notes == '-' ? null : notes;
          const queueItem = await prisma.cocktailQueue.findFirst({
            where: {
              workspaceId: workspace.id,
              cocktailId: cocktailId,
              notes: searchNote,
            },
            orderBy: {
              createdAt: 'asc',
            },
          });
          if (queueItem) {
            await prisma.cocktailQueue.delete({ where: { id: queueItem.id } });
          }
        } else {
          // Ask user which one to remove
          // list with the oldest cocktail grouped by cocktailId and notes
          const oldestEntries = await prisma.cocktailQueue.groupBy({
            by: ['cocktailId', 'notes'],
            where: {
              workspaceId: workspace.id,
              cocktailId: cocktailId,
            },
            _min: {
              createdAt: true, // Wir wollen das älteste Datum
              id: true, // Option, um den Datensatz selbst zu identifizieren
            },
            orderBy: {
              _min: {
                createdAt: 'asc',
              },
            },
          });

          // Check if there are any cocktails with notes
          const notesEntry = oldestEntries.find((entry) => entry.notes != null);

          if (notesEntry == null && oldestEntries.length > 0 && oldestEntries[0]._min?.id != null) {
            // Delete the oldest entry without notes
            await prisma.cocktailQueue.delete({ where: { id: oldestEntries[0]._min.id } });
          } else {
            return res.status(400).json({ message: StatisticBadRequestMessage, data: oldestEntries });
          }
        }
      }
    }

    // Add the statistic item
    const result = await prisma.cocktailStatisticItem.create({
      data: input,
    });
    return res.json({ data: result });
  }),
});
