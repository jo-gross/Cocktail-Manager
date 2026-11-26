import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { readWorkspaceBackup } from '@lib/backup/readWorkspaceBackup';
import { EXPORT_STATUS_EXEMPTION, withStatusExemption } from '@lib/entitlements/statusGate';

export { readWorkspaceBackup };

/**
 * Full workspace export (admins; API keys need BACKUPS_EXPORT). Contains no secrets:
 * the workspace row (signage key), API keys and join codes are not exported and
 * guest menus are stripped of access code and preview token.
 */
const exportRoutes = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.ADMIN], Permission.BACKUPS_EXPORT, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const backup = await readWorkspaceBackup(workspace.id);
    console.info(`[BackupExport][${workspace.id}] Export finished`, {
      cocktails: backup.cocktailRecipe.length,
      ingredients: backup.ingredient.length,
      calculations: backup.calculation.length,
      signageSlides: backup.signageSlides?.length ?? 0,
      guestMenus: backup.guestMenus?.length ?? 0,
    });
    return res.json(backup);
  }),
});

// Exports stay available in a read-only or suspended workspace (docs/ENTITLEMENTS.md "Status").
export default withStatusExemption(EXPORT_STATUS_EXEMPTION, exportRoutes);
