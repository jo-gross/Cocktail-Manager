/**
 * Creates a throw-away demo user with a demo workspace (one transaction):
 * - `full`: `BASE` + the default `DEMO` template in the visitor's language (guest menus stay
 *   published) + sample activity (statistics, ratings, queue);
 * - `setup`: `BASE` only and the setup assistant still open, to try the assistant.
 * The database decides which `DEMO` template is used (default `DEMO` template, else key `demo`);
 * built-in ones and the fallback (no template in the database) come from `templates/<key>/`.
 */
import { Role, Setting } from '@generated/prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../../prisma/prisma';
import packageInfo from '../../package.json';
import { BULK_TX_TIMEOUT_MS, runTx } from '@lib/db/tx';
import { BackupImportSchema } from '@lib/backup/backupSchema';
import { executeBackupImport, prepareBackupImport, type PreparedImport } from '@lib/backup/importHandler';
import { regenerateUnitConversionsTx } from '@lib/api/controllers/units';
import type { AppLocale } from '@lib/i18n/locales';
import { serializeContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { loadBuiltInTemplate } from '@lib/templates/builtIn';
import { ensureBuiltInTemplatesSafe, readTemplateContent, withoutContentLocales } from '@lib/templates/applyTemplate';
import { createWorkspaceTx, loadBaseTemplate } from '@lib/templates/createWorkspace';
import { pivotTemplateLocale } from '@lib/templates/transform';
import { getDemoTtlHours } from '@lib/demo/config';
import { writeSampleActivityTx } from '@lib/demo/sampleActivity';

export const DEMO_TEMPLATE_KEY = 'demo';

export const DEMO_MODES = ['full', 'setup'] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

const DEMO_TEXTS: Record<AppLocale, { user: string; workspace: string; description: (hours: number) => string }> = {
  de: {
    user: 'Demo-Nutzer',
    workspace: 'Demo-Bar',
    description: (hours) => `Willkommen in der Demo! Dieser Workspace wird nach ${hours} Stunden automatisch gelöscht.`,
  },
  en: {
    user: 'Demo user',
    workspace: 'Demo bar',
    description: (hours) => `Welcome to the demo! This workspace is deleted automatically after ${hours} hours.`,
  },
};

interface PreparedDemoTemplate {
  key: string;
  version: number;
  /** Content languages of the template (the visitor's language first). */
  locales: string[];
  prepared: PreparedImport;
}

/**
 * Loads the `DEMO` template in `locale` (outside of any transaction). Built-in templates are read
 * from their repo files: the memberless database copy has no calculations (they need a user).
 */
export async function loadDemoTemplate(locale: AppLocale): Promise<PreparedDemoTemplate> {
  const withLocale = (locales: string[]) => [locale, ...locales.filter((entry) => entry !== locale)];
  await ensureBuiltInTemplatesSafe();
  let builtInKey = DEMO_TEMPLATE_KEY;
  try {
    const template =
      (await prisma.workspaceTemplate.findFirst({ where: { kind: 'DEMO', isDefault: true, published: true } })) ??
      (await prisma.workspaceTemplate.findFirst({ where: { kind: 'DEMO', key: DEMO_TEMPLATE_KEY } }));
    if (template?.builtIn) builtInKey = template.key;
    else if (template) {
      const { data, locale: from } = await readTemplateContent(template);
      return {
        key: template.key,
        version: template.version,
        locales: withLocale(template.locales),
        prepared: prepareBackupImport(pivotTemplateLocale(withoutContentLocales(data), from, locale)),
      };
    }
  } catch (error) {
    console.error('[Demo] Reading the DEMO template from the database failed, using the repo file:', error);
  }
  const { manifest, backup } = loadBuiltInTemplate(builtInKey);
  const data = BackupImportSchema.parse(backup);
  return {
    key: manifest.key,
    version: manifest.version,
    locales: withLocale(manifest.locales),
    prepared: prepareBackupImport(pivotTemplateLocale(withoutContentLocales(data), manifest.locales[0]!, locale)),
  };
}

export interface CreateDemoWorkspaceOptions {
  locale: AppLocale;
  mode: DemoMode;
  now?: Date;
}

export interface CreatedDemoWorkspace {
  workspaceId: string;
  userId: string;
  expiresAt: Date;
}

export async function createDemoWorkspace({ locale, mode, now = new Date() }: CreateDemoWorkspaceOptions): Promise<CreatedDemoWorkspace> {
  // File and template access happens before the transaction.
  const base = await loadBaseTemplate();
  const demoTemplate = mode === 'full' ? await loadDemoTemplate(locale) : null;

  const ttlHours = getDemoTtlHours();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const userId = randomUUID();
  const texts = DEMO_TEXTS[locale];

  const workspaceId = await runTx(
    async (tx) => {
      // Demo user without e-mail; it can only log in via a demo login token.
      await tx.user.create({ data: { id: userId, name: texts.user, email: null } });
      await tx.userSetting.createMany({
        data: [
          { userId, setting: Setting.language, value: locale },
          // No "what's new" dialog for a brand-new demo user.
          { userId, setting: Setting.lastSeenVersion, value: packageInfo.version },
          // Show what the sample data offers: images, "made"/queue actions and the queue.
          ...(mode === 'full'
            ? [
                { userId, setting: Setting.showImage, value: 'true' },
                { userId, setting: Setting.showStatisticActions, value: 'true' },
              ]
            : []),
        ],
      });

      const workspace = await createWorkspaceTx(
        tx,
        {
          name: texts.workspace,
          description: texts.description(ttlHours),
          owner: { userId, role: Role.OWNER },
          demo: { demoUserId: userId, expiresAt },
          locale,
          // `setup` starts in the setup assistant; the full demo is ready to use.
          setupCompleted: mode === 'full',
        },
        base,
      );

      if (demoTemplate) {
        await executeBackupImport(tx, demoTemplate.prepared, { id: userId }, workspace.id, {
          keepGuestMenuState: true,
          settings: 'merge',
          audit: {
            entityType: 'WorkspaceTemplate',
            action: 'APPLY_TEMPLATE',
            details: { template: demoTemplate.key, version: demoTemplate.version, mode: 'all' },
          },
        });
        await tx.workspaceSetting.update({
          where: { workspaceId_setting: { workspaceId: workspace.id, setting: 'contentLocales' } },
          data: { value: serializeContentLocales({ primary: locale, additional: demoTemplate.locales.slice(1) }) },
        });
        await regenerateUnitConversionsTx(tx, workspace.id);
        await writeSampleActivityTx(tx, { workspaceId: workspace.id, userId, locale, now });
      }
      return workspace.id;
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );

  return { workspaceId, userId, expiresAt };
}
