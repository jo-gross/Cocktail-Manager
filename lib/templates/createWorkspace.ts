/**
 * The one way to create a workspace (UI, instance admin API, demo, external OIDC groups):
 * empty workspace → `BASE` template (units, conversions, ice, step actions, labels, tag
 * categories) → regenerated unit conversions, all in one transaction. The `BASE` template
 * comes from the database (default `BASE` template, else key `base`) and falls back to the
 * repo file `templates/base/`, so creation never depends on the template sync.
 */
import type { Role, User, Workspace } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { runTx, type Tx } from '@lib/db/tx';
import { executeBackupImport, prepareBackupImport, type PreparedImport } from '@lib/backup/importHandler';
import { regenerateUnitConversionsTx } from '@lib/api/controllers/units';
import { loadBuiltInTemplate } from '@lib/templates/builtIn';
import { ensureBuiltInTemplatesSafe, readTemplateContent, withoutContentLocales } from '@lib/templates/applyTemplate';

export const BASE_TEMPLATE_KEY = 'base';

export interface CreateWorkspaceOptions {
  name: string;
  description?: string | null;
  /** First member (UI: the creator as OWNER); none = memberless, first joiner becomes OWNER. */
  owner?: { userId: string; role: Role };
  /** Reusable join code (instance admin API). */
  joinCode?: string;
  /** Demo workspaces (see `/api/demo/create-workspace`). */
  demo?: { demoUserId: string; expiresAt: Date };
  /** Primary content language (`contentLocales`); omitted = app default. */
  locale?: string;
  /** Fixed id (workspaces managed via external OIDC groups). */
  id?: string;
  /** Skip the setup assistant (`setupCompletedAt = now`). */
  setupCompleted?: boolean;
}

export interface PreparedBaseTemplate {
  key: string;
  version: number;
  prepared: PreparedImport;
}

/** Loads and validates the `BASE` template (outside of any transaction). */
export async function loadBaseTemplate(): Promise<PreparedBaseTemplate> {
  await ensureBuiltInTemplatesSafe();
  try {
    const template =
      (await prisma.workspaceTemplate.findFirst({ where: { kind: 'BASE', isDefault: true } })) ??
      (await prisma.workspaceTemplate.findFirst({ where: { kind: 'BASE', key: BASE_TEMPLATE_KEY } }));
    if (template) {
      const { data } = await readTemplateContent(template);
      return { key: template.key, version: template.version, prepared: prepareBackupImport(withoutContentLocales(data)) };
    }
  } catch (error) {
    console.error('[Templates] Reading the BASE template from the database failed, using the repo file:', error);
  }
  const { manifest, backup } = loadBuiltInTemplate(BASE_TEMPLATE_KEY);
  return { key: manifest.key, version: manifest.version, prepared: prepareBackupImport(backup) };
}

/** Creates the workspace inside `tx` (callers that create more in the same transaction, e.g. the demo). */
export async function createWorkspaceTx(tx: Tx, options: CreateWorkspaceOptions, base: PreparedBaseTemplate): Promise<Workspace> {
  const { name, description, owner, joinCode, demo, locale, id, setupCompleted } = options;
  const workspace = await tx.workspace.create({
    data: {
      ...(id ? { id } : {}),
      name,
      ...(description !== undefined ? { description } : {}),
      ...(demo ? { isDemo: true, demoUserId: demo.demoUserId, expiresAt: demo.expiresAt } : {}),
      setupCompletedAt: setupCompleted ? new Date() : null,
      ...(owner ? { users: { create: { userId: owner.userId, role: owner.role } } } : {}),
      ...(joinCode ? { WorkspaceJoinCode: { create: { code: joinCode, expires: null, onlyUseOnce: false } } } : {}),
    },
  });

  const actor: Pick<User, 'id'> | null = owner ? { id: owner.userId } : null;
  await executeBackupImport(tx, base.prepared, actor, workspace.id, {
    audit: { entityType: 'WorkspaceTemplate', action: 'APPLY_TEMPLATE', details: { template: base.key, version: base.version, mode: 'all' } },
  });
  if (locale) {
    await tx.workspaceSetting.create({
      data: { workspaceId: workspace.id, setting: 'contentLocales', value: JSON.stringify({ primary: locale, additional: [] }) },
    });
  }
  await regenerateUnitConversionsTx(tx, workspace.id);
  return workspace;
}

export async function createWorkspace(options: CreateWorkspaceOptions): Promise<Workspace> {
  const base = await loadBaseTemplate();
  return runTx((tx) => createWorkspaceTx(tx, options, base));
}
