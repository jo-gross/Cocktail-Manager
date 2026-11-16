/**
 * Copies the built-in templates (`templates/<key>/`) into the database: a memberless,
 * read-only workspace plus its `WorkspaceTemplate` row (`builtIn = true`). Runs when the
 * key is missing or the repo version is higher; an update replaces only the built-in
 * copy (clones have their own key and are never touched). Idempotent and safe under
 * concurrency (advisory lock + re-check), memoized per process.
 */
import { Prisma, type TemplateKind } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { BULK_TX_TIMEOUT_MS, lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';
import { executeBackupImport, prepareBackupImport } from '@lib/backup/importHandler';
import { regenerateUnitConversionsTx } from '@lib/api/controllers/units';
import { listBuiltInTemplateKeys, loadBuiltInTemplate, readBuiltInManifest } from '@lib/templates/builtIn';
import type { TemplateManifest } from '@lib/templates/manifest';

/** Global lock for template metadata (sync, default flags). */
export async function lockTemplates(tx: Tx): Promise<void> {
  await lockWorkspaceScope(tx, 'instance', 'workspace-templates');
}

export function contentLocalesValue(locales: string[]): string {
  return JSON.stringify({ primary: locales[0], additional: locales.slice(1) });
}

/** Clears `isDefault` of the other templates of `kind` (call under {@link lockTemplates}). */
export async function clearOtherDefaults(tx: Tx, kind: TemplateKind, workspaceId: string): Promise<void> {
  await tx.workspaceTemplate.updateMany({ where: { kind, isDefault: true, workspaceId: { not: workspaceId } }, data: { isDefault: false } });
}

async function syncTemplate(key: string): Promise<'created' | 'updated' | 'current'> {
  const manifest = readBuiltInManifest(key);
  const existing = await prisma.workspaceTemplate.findUnique({ where: { key }, select: { version: true, builtIn: true } });
  if (existing && (!existing.builtIn || existing.version >= manifest.version)) return 'current';

  // File access and validation before the transaction.
  const { backup } = loadBuiltInTemplate(key);
  const prepared = prepareBackupImport(backup);

  return runTx(
    async (tx) => {
      await lockTemplates(tx);
      const current = await tx.workspaceTemplate.findUnique({ where: { key } });
      // A custom template took the key, or another process was faster.
      if (current && (!current.builtIn || current.version >= manifest.version)) return 'current';

      const workspace = await createTemplateWorkspace(tx, manifest);
      await executeBackupImport(tx, prepared, null, workspace.id, {
        keepGuestMenuState: true,
        audit: { entityType: 'WorkspaceTemplate', action: 'SYNC_BUILT_IN', details: { template: key, version: manifest.version } },
      });
      await tx.workspaceSetting.upsert({
        where: { workspaceId_setting: { workspaceId: workspace.id, setting: 'contentLocales' } },
        create: { workspaceId: workspace.id, setting: 'contentLocales', value: contentLocalesValue(manifest.locales) },
        update: { value: contentLocalesValue(manifest.locales) },
      });
      await regenerateUnitConversionsTx(tx, workspace.id);

      // The database decides about publishing, default and order once the template exists.
      const published = current?.published ?? manifest.published;
      const isDefault = current?.isDefault ?? manifest.isDefault;
      const sortOrder = current?.sortOrder ?? manifest.sortOrder;
      if (current) await tx.workspace.delete({ where: { id: current.workspaceId } });
      if (isDefault) await clearOtherDefaults(tx, manifest.kind, workspace.id);
      await tx.workspaceTemplate.create({
        data: {
          workspaceId: workspace.id,
          key,
          kind: manifest.kind,
          name: manifest.name,
          description: manifest.description ?? Prisma.DbNull,
          locales: manifest.locales,
          source: manifest.source ?? null,
          builtIn: true,
          version: manifest.version,
          published,
          isDefault,
          sortOrder,
        },
      });
      return current ? 'updated' : 'created';
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );
}

/** Memberless, already set-up workspace that holds a template's content. */
export function createTemplateWorkspace(tx: Tx, manifest: Pick<TemplateManifest, 'name' | 'locales'>) {
  const name = manifest.name[manifest.locales[0]!] ?? Object.values(manifest.name)[0] ?? 'Template';
  return tx.workspace.create({ data: { name: name.slice(0, 100), setupCompletedAt: new Date() } });
}

/** Syncs every built-in template; a broken one is logged and does not block the others. */
export async function syncBuiltInTemplates(): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const key of listBuiltInTemplateKeys()) {
    try {
      const result = await syncTemplate(key);
      if (result !== 'current') console.info(`[Templates] Built-in template "${key}" ${result}`);
    } catch (error) {
      failed.push(key);
      console.error(`[Templates] Syncing built-in template "${key}" failed:`, error);
    }
  }
  return { failed };
}

let synced: Promise<void> | null = null;

/** Syncs the built-in templates once per process (again after a failure, or with `force`). */
export function ensureBuiltInTemplates(options: { force?: boolean } = {}): Promise<void> {
  if (!synced || options.force) {
    const current: Promise<void> = syncBuiltInTemplates().then(
      ({ failed }) => {
        if (failed.length > 0 && synced === current) synced = null;
      },
      (error) => {
        if (synced === current) synced = null;
        throw error;
      },
    );
    synced = current;
  }
  return synced;
}
