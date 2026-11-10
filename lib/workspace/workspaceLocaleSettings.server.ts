import prisma from '../../prisma/prisma';
import { WorkspaceSettingKey } from '@generated/prisma/client';
import { getWorkspaceLocaleSettings, type RawWorkspaceSettings, type WorkspaceLocaleSettings } from './workspaceLocaleSettings';

/** Loads timezone, currency and contentLocales for a workspace (defaults applied). */
export async function loadWorkspaceLocaleSettings(workspaceId: string): Promise<WorkspaceLocaleSettings> {
  const rows = await prisma.workspaceSetting.findMany({
    where: {
      workspaceId,
      setting: { in: [WorkspaceSettingKey.timezone, WorkspaceSettingKey.currency, WorkspaceSettingKey.contentLocales] },
    },
  });
  const raw: RawWorkspaceSettings = {};
  for (const row of rows) raw[row.setting] = row.value;
  return getWorkspaceLocaleSettings(raw);
}
