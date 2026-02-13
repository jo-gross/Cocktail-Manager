import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role, Workspace } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { diff } from 'deep-diff';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    Permission.WORKSPACE_READ, // Use a general permission or specific if available
    async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
      const { entityType, entityId, limit = '50', page = '1' } = req.query;

      const pageInt = parseInt(page as string);
      const limitInt = parseInt(limit as string);
      const skip = (pageInt - 1) * limitInt;

      const where: any = {
        workspaceId: workspace.id,
      };

      if (entityType) {
        where.entityType = entityType as string;
      }
      if (entityId) {
        where.entityId = entityId as string;
      }

      // We fetch limit + 1 to calculate the diff for the oldest item in the current page using the item from next page/previous time
      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limitInt + 1, // Fetch one extra for diff context
          skip: skip,
        }),
      ]);

      const hasMore = logs.length > limitInt;
      const visibleLogs = hasMore ? logs.slice(0, limitInt) : logs;
      const contextLogs = logs; // We use the full fetched list for context

      // Calculate diffs on the fly
      const processedLogs = visibleLogs.map((log, index) => {
        // If it's already an array (legacy diff), return as is
        if (Array.isArray(log.changes)) {
          // Ensure legacy Create (which might be object?) is handled.
          // Wait, legacy create was object?
          // My previous code: "else if (action === 'CREATE') changes = newData;" -> Object
          // My previous code: "changes = diff(...)" -> Array
          // So Create/Delete were Objects in legacy too.
          // But deep-diff returns array.
          // If it is an array -> it is a diff.
          // If it is an object -> it is a snapshot (legacy Create/Delete OR new Snapshot).

          // If action is UPDATE and it is Array -> Legacy Diff. Return as is.
          return log;
        }

        // It is an object (Snapshot).
        // We need to calculate diff against previous state (which is next in the list because desc sort)
        const previousLog = contextLogs[index + 1];
        let changes: any = log.changes;

        if (log.action === 'UPDATE') {
          if (previousLog && !Array.isArray(previousLog.changes)) {
            // Compare current snapshot with previous snapshot
            changes = diff(previousLog.changes as any, log.changes as any);
          } else {
            // No previous state or previous state is legacy diff -> Treat as "New" (or just return snapshot? Frontend handles arrays only for updates?)
            // Frontend renderDiff: "if (log.action === 'UPDATE' && Array.isArray(log.changes))"
            // So if we return object, frontend shows nothing or breaks?
            // Frontend handles 'CREATE'/'DELETE' separately.
            // For UPDATE, it expects Array.
            // So if we can't compute diff, we should probably output "Everything new".
            changes = diff({}, log.changes as any);
          }
        } else if (log.action === 'CREATE') {
          // Create usually shows the object. Frontend expects object for Create?
          // Frontend: "if (log.action === 'CREATE') return 'Erstellt'" (It doesn't show content currently, just title)
          // If we want to show content, we can return the snapshot.
          changes = log.changes;
        } else if (log.action === 'DELETE') {
          // Similar to create
          changes = log.changes;
        }

        return {
          ...log,
          changes,
        };
      });

      return res.json({
        data: processedLogs,
        pagination: {
          total,
          list_total: visibleLogs.length,
          page: pageInt,
          totalPages: Math.ceil(total / limitInt),
        },
      });
    },
  ),
});
