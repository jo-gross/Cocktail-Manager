import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withDeprecation } from '@middleware/api/withDeprecation';
import { Role, Permission, WorkspaceSettingKey } from '@generated/prisma/client';
import prisma from '../../../../../prisma/prisma';

const legacyHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.WORKSPACE_READ, async (req, res, user, workspace) => {
    const settings = await prisma.workspaceSetting.findMany({
      where: { workspaceId: workspace.id },
    });

    const settingsMap: Record<string, string | null> = {};
    settings.forEach((s) => {
      settingsMap[s.setting] = s.value;
    });

    return res.json({ data: settingsMap });
  }),

  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.WORKSPACE_UPDATE, async (req, res, user, workspace) => {
    const { setting, value } = JSON.parse(req.body);

    if (!Object.values(WorkspaceSettingKey).includes(setting)) {
      return res.status(400).json({ message: 'Invalid setting key' });
    }

    const result = await prisma.workspaceSetting.upsert({
      where: {
        workspaceId_setting: {
          workspaceId: workspace.id,
          setting: setting,
        },
      },
      create: {
        workspaceId: workspace.id,
        setting: setting,
        value: value,
      },
      update: {
        value: value,
      },
    });

    return res.json({ data: result });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/settings' }, legacyHandler);
