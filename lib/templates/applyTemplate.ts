/**
 * Applies a template (a workspace marked in `WorkspaceTemplate`) to a target workspace on
 * the backup pipeline: read → select (+ dependencies) → language pivot → link duplicates →
 * `executeBackupImport` in one transaction. See docs/plans/ONBOARDING-PLAN.md §1.
 */
import type { TemplateKind, User, WorkspaceTemplate } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { BULK_TX_TIMEOUT_MS, runTx } from '@lib/db/tx';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { readWorkspaceBackup } from '@lib/backup/readWorkspaceBackup';
import { BackupImportSchema, type BackupImportData } from '@lib/backup/backupSchema';
import { executeBackupImport, prepareBackupImport, type BackupImportOptions } from '@lib/backup/importHandler';
import { regenerateUnitConversionsTx } from '@lib/api/controllers/units';
import { parseContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { loadWorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings.server';
import { ensureBuiltInTemplates } from '@lib/templates/sync';
import { builtInImageCredits, fillImageCreditsByName } from '@lib/templates/credits';
import { withGuestMenuTheme, type BusinessType } from '@lib/templates/guestMenuTheme';
import {
  dropExistingCards,
  findExistingMatches,
  findUnknownSelectionIds,
  pivotTemplateLocale,
  selectTemplateContent,
  type TemplateApplyMode,
  type TemplateSelection,
} from '@lib/templates/transform';

export interface TemplateItemCounts {
  glasses: number;
  ingredients: number;
  garnishes: number;
  cocktails: number;
  cards: number;
  guestMenus: number;
}

export interface ApplyTemplateResult {
  template: string;
  created: TemplateItemCounts;
  /** Matched an existing record by name and reused it. */
  linked: TemplateItemCounts;
  /** Already present (cards with the same name, and guest menus built on them). */
  skipped: TemplateItemCounts;
}

export interface ApplyTemplateOptions {
  mode: TemplateApplyMode;
  selection?: TemplateSelection;
  /** Content language of the target; default: its primary content locale. */
  locale?: string;
  /** Acting user (audit log); null = system. */
  user?: Pick<User, 'id'> | null;
  /** API callers may only apply published templates. */
  publishedOnly?: boolean;
  /** Design of the guest menus that come with the template (setup wizard); default: the template's own. */
  businessType?: BusinessType;
}

const IMPORT_OPTIONS: Record<TemplateKind, BackupImportOptions> = {
  BASE: {},
  // A guest menu of a catalog goes live only in a workspace without guest menus (fresh from the setup wizard).
  CATALOG: { stripPrices: true, guestInfoUnconfirmed: true, keepGuestMenuState: 'ifNoMenus' },
  DEMO: { keepGuestMenuState: true },
};

/** Ensures the built-in templates are in the database; failures only fall back to what is there. */
export async function ensureBuiltInTemplatesSafe(): Promise<void> {
  try {
    await ensureBuiltInTemplates();
  } catch (error) {
    console.error('[Templates] Built-in template sync failed:', error);
  }
}

export async function findTemplate(key: string, publishedOnly: boolean): Promise<WorkspaceTemplate> {
  await ensureBuiltInTemplatesSafe();
  const template = await prisma.workspaceTemplate.findFirst({ where: { key, ...(publishedOnly ? { published: true } : {}) } });
  if (!template) throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
  return template;
}

/** Parsed content of a template workspace (backup format) and its primary content locale. */
export async function readTemplateContent(
  template: Pick<WorkspaceTemplate, 'workspaceId' | 'locales' | 'key'>,
): Promise<{ data: BackupImportData; locale: string }> {
  const parsed = BackupImportSchema.safeParse(await readWorkspaceBackup(template.workspaceId));
  if (!parsed.success) {
    console.error(`[Templates] Template "${template.key}" is not a valid backup`, parsed.error.issues.slice(0, 10));
    throw new ApiError(500, 'TEMPLATE_INVALID', 'The template is invalid');
  }
  const contentLocales = parsed.data.workspaceSettings.find((row) => row.setting === 'contentLocales')?.value;
  return { data: parsed.data, locale: contentLocales ? parseContentLocales(contentLocales).primary : (template.locales[0] ?? 'de') };
}

/** Settings a template never passes on: the target decides its content languages and owns its onboarding state. */
const TARGET_OWNED_SETTINGS: readonly string[] = ['contentLocales', 'onboardingChecklistSkipped'];

/** Template settings for a target: never its content languages or onboarding state (the target decides). */
export function withoutContentLocales(data: BackupImportData): BackupImportData {
  return { ...data, workspaceSettings: data.workspaceSettings.filter((row) => !TARGET_OWNED_SETTINGS.includes(row.setting)) };
}

async function loadExistingContent(workspaceId: string) {
  const named = { select: { id: true, name: true, translations: { select: { name: true } } } } as const;
  const [glasses, ingredients, garnishes, cocktails, cards] = await Promise.all([
    prisma.glass.findMany({ where: { workspaceId }, ...named }),
    prisma.ingredient.findMany({ where: { workspaceId }, ...named }),
    prisma.garnish.findMany({ where: { workspaceId }, ...named }),
    prisma.cocktailRecipe.findMany({ where: { workspaceId }, ...named }),
    prisma.cocktailCard.findMany({ where: { workspaceId }, select: { name: true } }),
  ]);
  const toRecord = (row: { id: string; name: string; translations: Array<{ name: string | null }> }) => ({
    id: row.id,
    names: [row.name, ...row.translations.map((translation) => translation.name)],
  });
  return {
    content: { glasses: glasses.map(toRecord), ingredients: ingredients.map(toRecord), garnishes: garnishes.map(toRecord), cocktails: cocktails.map(toRecord) },
    cardNames: cards.map((card) => card.name),
  };
}

export async function applyTemplate(targetWorkspaceId: string, templateKey: string, options: ApplyTemplateOptions): Promise<ApplyTemplateResult> {
  const template = await findTemplate(templateKey, options.publishedOnly ?? false);
  if (template.workspaceId === targetWorkspaceId) throw new ApiError(400, 'TEMPLATE_SELF_APPLY', 'A template cannot be applied to itself');

  const content = await readTemplateContent(template);
  if (options.mode === 'selection') {
    const unknown = findUnknownSelectionIds(content.data, options.selection ?? {});
    if (unknown.length > 0)
      throw new ApiError(400, 'INVALID_SELECTION', 'The selection contains items that are not part of the template', unknown.slice(0, 100));
  }
  const targetLocale = options.locale ?? (await loadWorkspaceLocaleSettings(targetWorkspaceId)).contentLocales.primary;
  // Credits are matched by the primary names of the template, so before the pivot.
  const credited = fillImageCreditsByName(content.data, builtInImageCredits(template));
  const selected = pivotTemplateLocale(
    withGuestMenuTheme(withoutContentLocales(selectTemplateContent(credited, options.mode, options.selection)), options.businessType),
    content.locale,
    targetLocale,
  );

  const existing = await loadExistingContent(targetWorkspaceId);
  const { data, skipped: skippedCards, skippedGuestMenus } = dropExistingCards(selected, existing.cardNames);
  const links = findExistingMatches(data, existing.content);
  const prepared = prepareBackupImport(data, links);

  const counts = await runTx(
    async (tx) => {
      // The links come from the target workspace; re-checked in the transaction.
      await assertIdsInWorkspace(tx, targetWorkspaceId, {
        glass: links.glass.values(),
        ingredient: links.ingredient.values(),
        garnish: links.garnish.values(),
        cocktail: links.cocktail.values(),
      });
      const result = await executeBackupImport(tx, prepared, options.user ?? null, targetWorkspaceId, {
        ...IMPORT_OPTIONS[template.kind],
        settings: 'merge',
        audit: {
          entityType: 'WorkspaceTemplate',
          action: 'APPLY_TEMPLATE',
          details: { template: template.key, version: template.version, mode: options.mode },
        },
      });
      await regenerateUnitConversionsTx(tx, targetWorkspaceId);
      return result;
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );

  return {
    template: template.key,
    created: {
      glasses: counts.glasses,
      ingredients: counts.ingredients,
      garnishes: counts.garnishes,
      cocktails: counts.cocktails,
      cards: counts.cards,
      guestMenus: counts.guestMenus,
    },
    linked: {
      glasses: prepared.linked.glass.size,
      ingredients: prepared.linked.ingredient.size,
      garnishes: prepared.linked.garnish.size,
      cocktails: prepared.linked.cocktail.size,
      cards: 0,
      guestMenus: 0,
    },
    skipped: { glasses: 0, ingredients: 0, garnishes: 0, cocktails: 0, cards: skippedCards, guestMenus: skippedGuestMenus },
  };
}
