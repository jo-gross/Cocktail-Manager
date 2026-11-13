/**
 * Business logic for cocktail export/import (JSON + PDF).
 *
 * IMPORTANT round-trip contract: the JSON export/import payloads are a raw data
 * dump that must re-import losslessly (see types/CocktailExportStructure.ts) —
 * they intentionally do NOT map to the clean public DTOs used elsewhere. The v1
 * route handlers write these results verbatim (no `{ data }` envelope).
 *
 * Tenant isolation: every read is filtered by the workspace (also the
 * dependencies of the exported cocktails), and every id an import decision
 * references ("use existing", "overwrite") is checked against the workspace
 * before anything is written.
 */
import prisma from '../../../prisma/prisma';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Page } from 'puppeteer-core';
import { withPdfPage } from '@lib/pdf/browser';
import { PDFDocument } from 'pdf-lib';
import type { z } from 'zod';
import { $Enums, Permission, Prisma } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import { createCocktailRecipeAuditLog, createLog } from '@lib/auditLog';
import { assertIdsInWorkspace, type ScopedEntity } from '@lib/api/scope';
import { BULK_TX_TIMEOUT_MS, lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';
import { ApiError } from '@lib/http/ApiError';
import { prismaErrorToApiError } from '@lib/http/prismaErrors';
import type { RequestApiKeyPermissions } from '@lib/http/requestAuth';
import { cocktailGuestInfoImportData, garnishGuestInfoImportData, ingredientGuestInfoImportData, parsePercent } from '@lib/guest-info/sanitize';
import { buildCocktailPdfLabels, CocktailPdfPage } from '@components/pdf/CocktailPdfPage';
import { getServerT } from '@lib/i18n/server';
import { normalizeLocale, type AppLocale } from '@lib/i18n/locales';
import { toIntlLocale } from '@lib/i18n/format';
import { resolveLabel } from '@lib/i18n/labelFallback';
import { loadWorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings.server';
import type { ContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { pdfExportTailwindConfigScript, pdfExportThemeStyles } from '@lib/pdf/pdfExportStyles';
import {
  CocktailImportDumpSchema,
  CocktailImportMappingDecisionsSchema,
  type CocktailExportPdfInput,
  type CocktailImportDump,
  type CocktailImportJsonInput,
  type CocktailImportMappingDecisions,
  type ImportEntityData,
} from '@lib/schemas/cocktails';
import { CocktailExportStructure } from '../../../types/CocktailExportStructure';
import packageJson from '../../../package.json';

const WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

/** Result signalled back to the (hand-wired) route handler, mirroring the legacy status/body. */
export type PortingResult = { status: number; body: unknown };

/**
 * Error body of the porting endpoints: the legacy `message` (read by the import
 * wizard) plus the standard v1 `error` envelope.
 */
export function portingError(code: string, message: string, extra: { issues?: unknown; errors?: unknown } = {}) {
  const { issues, ...rest } = extra;
  return { message, ...rest, error: { code, message, ...(issues !== undefined ? { issues } : {}) } };
}

function parseTranslations(raw: string | null | undefined, fallback: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Record<string, string>>) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Export JSON
// ---------------------------------------------------------------------------

export async function exportCocktailsJson(workspace: Workspace, cocktailIds: string[]): Promise<PortingResult> {
  const workspaceId = workspace.id;

  if (cocktailIds.length === 0) {
    return { status: 400, body: portingError('VALIDATION_ERROR', 'No cocktails selected') };
  }

  // One consistent snapshot over all tables.
  const exportData = await runTx(
    async (tx): Promise<CocktailExportStructure | null> => {
      const cocktailRecipes = await tx.cocktailRecipe.findMany({ where: { id: { in: cocktailIds }, workspaceId } });
      if (cocktailRecipes.length === 0) return null;
      const recipeIds = cocktailRecipes.map((r) => r.id);

      const cocktailRecipeImages = await tx.cocktailRecipeImage.findMany({ where: { cocktailRecipeId: { in: recipeIds }, cocktailRecipe: { workspaceId } } });
      const cocktailRecipeSteps = await tx.cocktailRecipeStep.findMany({ where: { cocktailRecipeId: { in: recipeIds }, cocktailRecipe: { workspaceId } } });
      const cocktailRecipeGarnishes = await tx.cocktailRecipeGarnish.findMany({
        where: { cocktailRecipeId: { in: recipeIds }, cocktailRecipe: { workspaceId } },
      });
      const cocktailRecipeIngredients = await tx.cocktailRecipeIngredient.findMany({
        where: { cocktailRecipeStepId: { in: cocktailRecipeSteps.map((s) => s.id) }, cocktailRecipeStep: { cocktailRecipe: { workspaceId } } },
      });

      const unique = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter((v): v is string => Boolean(v))));

      // Dependencies are loaded through the workspace filter, so a (corrupt) foreign
      // reference can never pull another workspace's data into the dump.
      const glasses = await tx.glass.findMany({ where: { id: { in: unique(cocktailRecipes.map((r) => r.glassId)) }, workspaceId } });
      const ice = await tx.ice.findMany({ where: { id: { in: unique(cocktailRecipes.map((r) => r.iceId)) }, workspaceId } });
      const garnishes = await tx.garnish.findMany({ where: { id: { in: unique(cocktailRecipeGarnishes.map((g) => g.garnishId)) }, workspaceId } });
      const ingredients = await tx.ingredient.findMany({ where: { id: { in: unique(cocktailRecipeIngredients.map((i) => i.ingredientId)) }, workspaceId } });
      const stepActions = await tx.workspaceCocktailRecipeStepAction.findMany({
        where: { id: { in: unique(cocktailRecipeSteps.map((s) => s.actionId)) }, workspaceId },
      });

      const glassIds = glasses.map((g) => g.id);
      const garnishIds = garnishes.map((g) => g.id);
      const ingredientIds = ingredients.map((i) => i.id);
      const glassImages = await tx.glassImage.findMany({ where: { glassId: { in: glassIds } } });
      const garnishImages = await tx.garnishImage.findMany({ where: { garnishId: { in: garnishIds } } });
      const ingredientImages = await tx.ingredientImage.findMany({ where: { ingredientId: { in: ingredientIds } } });
      const ingredientVolumes = await tx.ingredientVolume.findMany({ where: { ingredientId: { in: ingredientIds }, workspaceId } });

      const units = await tx.unit.findMany({
        where: { id: { in: unique([...ingredientVolumes.map((v) => v.unitId), ...cocktailRecipeIngredients.map((i) => i.unitId)]) }, workspaceId },
      });

      // References that did not resolve inside the workspace (legacy cross-tenant
      // rows) are dropped, so the dump neither names foreign ids nor fails re-import.
      const has = (rows: Array<{ id: string }>) => {
        const ids = new Set(rows.map((row) => row.id));
        return (id: string | null) => (id && ids.has(id) ? id : null);
      };
      const [glassRef, iceRef, garnishRef, ingredientRef, actionRef, unitRef] = [glasses, ice, garnishes, ingredients, stepActions, units].map(has);
      const steps = cocktailRecipeSteps.filter((step) => actionRef(step.actionId));
      const stepIds = new Set(steps.map((step) => step.id));

      return {
        exportVersion: packageJson.version,
        exportDate: new Date().toISOString(),
        exportedFrom: { workspaceId: workspace.id, workspaceName: workspace.name },
        cocktailRecipes: cocktailRecipes.map((r) => ({ ...r, glassId: glassRef(r.glassId), iceId: iceRef(r.iceId) })),
        cocktailRecipeImages,
        cocktailRecipeSteps: steps,
        cocktailRecipeGarnishes: cocktailRecipeGarnishes.filter((g) => garnishRef(g.garnishId)),
        cocktailRecipeIngredients: cocktailRecipeIngredients
          .filter((line) => stepIds.has(line.cocktailRecipeStepId))
          .map((line) => ({ ...line, ingredientId: ingredientRef(line.ingredientId), unitId: unitRef(line.unitId) })),
        glasses,
        glassImages,
        garnishes,
        garnishImages,
        ingredients,
        ingredientImages,
        ingredientVolumes,
        ice,
        units,
        stepActions,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );

  if (!exportData) return { status: 404, body: portingError('NOT_FOUND', 'No cocktails found') };
  return { status: 200, body: exportData };
}

// ---------------------------------------------------------------------------
// Export PDF
// ---------------------------------------------------------------------------

type CocktailRecipeWithDetails = Prisma.CocktailRecipeGetPayload<{
  include: {
    _count: { select: { CocktailRecipeImage: true } };
    CocktailRecipeImage: { select: { image: true } };
    ice: true;
    glass: { include: { _count: { select: { GlassImage: true } } } };
    garnishes: { include: { garnish: { include: { _count: { select: { GarnishImage: true } } } } } };
    steps: { include: { action: true; ingredients: { include: { ingredient: { include: { _count: { select: { IngredientImage: true } } } }; unit: true } } } };
    ratings: true;
  };
}>;

export type CocktailPdfOptions = CocktailExportPdfInput;

/** Discriminated result: either a rendered PDF or a JSON error. */
export type CocktailPdfResult = { kind: 'pdf'; buffer: Buffer } | { kind: 'error'; status: number; body: unknown };

const PDF_BATCH_SIZE = 10;
/** Upper bound for one batch (page load + Tailwind render + print). */
const PDF_BATCH_TIMEOUT_MS = 60_000;
/** Upper bound for the whole export, independent of the number of cocktails. */
const PDF_TOTAL_TIMEOUT_MS = 300_000;
/**
 * The export page uses the Tailwind play CDN (JS) for styling, so page scripts
 * stay enabled; everything else (images by URL, fonts, XHR, …) is blocked.
 * All user content is HTML-escaped (React + escapeHtml), images are inlined as
 * data URIs.
 */
const PDF_ALLOWED_URL = /^(?:data:|about:|blob:|https:\/\/cdn\.tailwindcss\.com(?:\/|$))/i;

class PdfTimeoutError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function restrictPdfPageNetwork(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (PDF_ALLOWED_URL.test(request.url())) void request.continue();
    else void request.abort('blockedbyclient');
  });
}

async function generatePdf(
  html: string,
  numberOfCocktails: number,
  timeoutMs: number,
  showHeader: boolean,
  showFooter: boolean,
  locale: AppLocale,
): Promise<Buffer> {
  return withPdfPage(async (page) => {
    page.setDefaultTimeout(timeoutMs);
    await restrictPdfPageNetwork(page);
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    await page.addScriptTag({ url: 'https://cdn.tailwindcss.com' });
    await page.addScriptTag({ content: pdfExportTailwindConfigScript });

    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });

    await page.evaluate(() => {
      document.body.style.backgroundColor = 'white';
      document.documentElement.style.backgroundColor = 'white';
    });

    // The Tailwind play CDN generates styles asynchronously after load.
    const renderWaitTime = Math.min(3000 + numberOfCocktails * 500, 8000, timeoutMs / 2);
    await new Promise((resolve) => setTimeout(resolve, renderWaitTime));

    await page.evaluate(() => {
      void document.body.offsetHeight;
    });

    const { t } = getServerT(locale);
    const formattedDate = new Date().toLocaleDateString(toIntlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric' });
    const pageLabel = escapeHtml(t('cocktail:pdfPageLabel'));

    const headerTemplate = showHeader
      ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 5mm;">
            <div style="flex: 1;"></div>
            <div style="flex: 1; text-align: center;">Cocktail-Manager Export</div>
            <div style="flex: 1; text-align: right;">${escapeHtml(formattedDate)}</div>
          </div>`
      : '<div></div>';

    const footerTemplate = showFooter
      ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; text-align: center; padding: 0 5mm;">
            ${pageLabel} <span class="pageNumber"></span>
          </div>`
      : '<div></div>';

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: showHeader ? '10mm' : '5mm',
        right: '5mm',
        bottom: showFooter ? '10mm' : '5mm',
        left: '5mm',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: showHeader || showFooter,
      headerTemplate,
      footerTemplate,
      timeout: timeoutMs,
    });

    return Buffer.from(pdfBuffer);
  });
}

/** Builds the print HTML of one batch (exported for tests). */
export function generateHtmlForCocktails(
  cocktails: CocktailRecipeWithDetails[],
  translations: Record<string, Record<string, string>>,
  options: {
    exportImage: boolean;
    exportDescription: boolean;
    exportNotes: boolean;
    exportHistory: boolean;
    newPagePerCocktail: boolean;
    showHeader: boolean;
    showFooter: boolean;
    locale: AppLocale;
    contentLocales: ContentLocales;
  },
): string {
  const { t } = getServerT(options.locale);
  const labels = buildCocktailPdfLabels(t);
  const pages = cocktails.map((cocktail, index) => {
    const imageBase64 = options.exportImage ? cocktail.CocktailRecipeImage?.[0]?.image || null : null;
    const componentHtml = renderToString(
      React.createElement(CocktailPdfPage, {
        cocktail,
        imageBase64,
        getTranslation: (key: string) => resolveLabel(translations, key, options.locale, options.contentLocales),
        labels,
        locale: options.locale,
        exportImage: options.exportImage,
        exportDescription: options.exportDescription,
        exportNotes: options.exportNotes,
        exportHistory: options.exportHistory,
      }),
    );
    const pageBreakClass = options.newPagePerCocktail ? 'pdf-page' : 'pdf-page-no-break';
    return `<div class="${pageBreakClass}" data-cocktail-id="${escapeHtml(cocktail.id)}" data-cocktail-index="${index}" data-cocktail-name="${escapeHtml(cocktail.name)}">${componentHtml}</div>`;
  });

  const headerFooterStyles =
    options.showHeader || options.showFooter
      ? `
    @page {
      margin-top: ${options.showHeader ? '10mm' : '5mm'};
      margin-bottom: ${options.showFooter ? '10mm' : '5mm'};
    }
    `
      : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(options.locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cocktail Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>${pdfExportTailwindConfigScript}</script>

  <style>
    ${pdfExportThemeStyles}
    html {
      -webkit-print-color-adjust: exact;
    }

    * {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body {
      background: white;
    }
    .pdf-page {
      page-break-after: always;
      background: white;
    }
    .pdf-page:last-child {
      page-break-after: auto;
      min-height: auto;
    }
    /* Nur für Seiten, die nicht die letzte sind, volle Höhe erzwingen */
    .pdf-page:not(:last-child) {
      min-height: 100vh;
    }
    .pdf-page-no-break {
      background: white;
      margin-bottom: 2rem;
    }
    ${headerFooterStyles}
  </style>
</head>
<body class='bg-white'>
  ${pages.join('')}
</body>
</html>`;
}

export async function exportCocktailsPdf(workspace: Workspace, options: CocktailPdfOptions): Promise<CocktailPdfResult> {
  const {
    cocktailIds,
    exportImage = true,
    exportDescription = true,
    exportNotes = true,
    exportHistory = true,
    newPagePerCocktail = true,
    showHeader = false,
    showFooter = false,
    locale: localeOption,
  } = options;
  const locale = normalizeLocale(localeOption);

  if (cocktailIds.length === 0) {
    return { kind: 'error', status: 400, body: portingError('VALIDATION_ERROR', 'cocktailIds array is required and must not be empty') };
  }

  const cocktails = await prisma.cocktailRecipe.findMany({
    where: { id: { in: cocktailIds }, workspaceId: workspace.id },
    include: {
      _count: { select: { CocktailRecipeImage: true } },
      CocktailRecipeImage: { select: { image: true } },
      ice: true,
      glass: { include: { _count: { select: { GlassImage: true } } } },
      garnishes: { include: { garnish: { include: { _count: { select: { GarnishImage: true } } } } } },
      steps: {
        include: {
          action: true,
          ingredients: { include: { ingredient: { include: { _count: { select: { IngredientImage: true } } } }, unit: true } },
        },
      },
      ratings: true,
    },
    orderBy: { name: 'asc' },
  });

  if (cocktails.length === 0) {
    return { kind: 'error', status: 404, body: portingError('NOT_FOUND', 'No cocktails found') };
  }

  if (!process.env.CHROMIUM_HOST) {
    return { kind: 'error', status: 503, body: portingError('SERVICE_UNAVAILABLE', 'PDF export service is not configured') };
  }

  const translationSetting = await prisma.workspaceSetting.findFirst({
    where: { workspaceId: workspace.id, setting: WorkspaceSettingKey.translations },
  });
  const translations = parseTranslations(translationSetting?.value, { de: {} });
  const { contentLocales } = await loadWorkspaceLocaleSettings(workspace.id);

  const deadline = Date.now() + PDF_TOTAL_TIMEOUT_MS;
  try {
    const pdfBuffers: Buffer[] = [];
    for (let i = 0; i < cocktails.length; i += PDF_BATCH_SIZE) {
      const batch = cocktails.slice(i, i + PDF_BATCH_SIZE);
      const remaining = deadline - Date.now();
      if (remaining <= 1_000) throw new PdfTimeoutError();
      const html = generateHtmlForCocktails(batch, translations, {
        exportImage,
        exportDescription,
        exportNotes,
        exportHistory,
        newPagePerCocktail,
        showHeader,
        showFooter,
        locale,
        contentLocales,
      });
      pdfBuffers.push(await generatePdf(html, batch.length, Math.min(PDF_BATCH_TIMEOUT_MS, remaining), showHeader, showFooter, locale));
    }

    const mergedPdf = await PDFDocument.create();
    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const pdfPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pdfPages.forEach((page) => mergedPdf.addPage(page));
    }

    const finalPdfBytes = await mergedPdf.save();
    return { kind: 'pdf', buffer: Buffer.from(finalPdfBytes) };
  } catch (error) {
    console.error('PDF export error:', error);
    if (error instanceof PdfTimeoutError || (error instanceof Error && error.name === 'TimeoutError')) {
      return { kind: 'error', status: 504, body: portingError('TIMEOUT', 'PDF generation timed out') };
    }
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return { kind: 'error', status: 503, body: portingError('SERVICE_UNAVAILABLE', 'Chromium service is not available') };
    }
    return { kind: 'error', status: 500, body: portingError('INTERNAL_ERROR', 'PDF generation failed') };
  }
}

// ---------------------------------------------------------------------------
// Import JSON — three phases (validate / prepare-mapping / execute).
// Execute is all-or-nothing: the dump and the mapping decisions are validated
// completely before anything is written; the writes then run in ONE transaction
// (a failure rolls everything back and is reported as an error).
// ---------------------------------------------------------------------------

export interface ImportIssue {
  step: string;
  entityType: string;
  entityName: string;
  error: string;
}

const MAX_REPORTED_ISSUES = 100;

/** Raised inside the import transaction to roll back and answer 400 with per-item issues. */
class ImportValidationError extends Error {
  constructor(public readonly issues: ImportIssue[]) {
    super('Import validation failed');
  }
}

function zodIssuesToImportIssues(root: string, issues: z.core.$ZodIssue[]): ImportIssue[] {
  return issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
    step: 'validation',
    entityType: String(issue.path[0] ?? root),
    entityName: [root, ...issue.path.map(String)].join('.'),
    error: issue.message,
  }));
}

function invalidImport(message: string, issues: ImportIssue[]): PortingResult {
  return { status: 400, body: portingError('INVALID_IMPORT', message, { errors: issues.slice(0, MAX_REPORTED_ISSUES), issues }) };
}

type EntityKind = 'glasses' | 'garnishes' | 'ingredients' | 'units' | 'ice' | 'stepActions';

const ENTITY_LABELS: Record<EntityKind, string> = {
  glasses: 'Glas',
  garnishes: 'Garnitur',
  ingredients: 'Zutat',
  units: 'Einheit',
  ice: 'Eis-Typ',
  stepActions: 'Aktion',
};

const ENTITY_SCOPE: Record<EntityKind, ScopedEntity> = {
  glasses: 'glass',
  garnishes: 'garnish',
  ingredients: 'ingredient',
  units: 'unit',
  ice: 'ice',
  stepActions: 'action',
};

const ENTITY_KINDS = Object.keys(ENTITY_LABELS) as EntityKind[];

interface DumpEntity {
  id: string;
  name: string;
}

/** Checks the mapping decisions against the dump without touching the database. */
function validateDecisions(dump: CocktailImportDump, decisions: CocktailImportMappingDecisions): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const decided = {} as Record<EntityKind, Set<string>>;

  for (const kind of ENTITY_KINDS) {
    const entities = new Map((dump[kind] as DumpEntity[]).map((entity) => [entity.id, entity]));
    decided[kind] = new Set();
    for (const decision of decisions[kind]) {
      const entity = entities.get(decision.exportId);
      const entityName = entity?.name ?? decision.exportId;
      const issue = (error: string) => issues.push({ step: kind, entityType: ENTITY_LABELS[kind], entityName, error });
      if (!entity) issue('Nicht im Export enthalten');
      else if (decided[kind].has(decision.exportId)) issue('Mehrfach zugeordnet');
      else if (decision.decision === 'use-existing' && !decision.existingId) issue('Kein bestehender Eintrag ausgewählt');
      decided[kind].add(decision.exportId);
    }
  }

  const cocktails = new Map(dump.cocktailRecipes.map((cocktail) => [cocktail.id, cocktail]));
  const seenCocktails = new Set<string>();
  const seenOverwrites = new Set<string>();
  for (const decision of decisions.cocktails) {
    const cocktail = cocktails.get(decision.exportId);
    const entityName = cocktail?.name ?? decision.exportId;
    const issue = (error: string) => issues.push({ step: 'cocktails', entityType: 'Cocktail', entityName, error });
    if (!cocktail) {
      issue('Nicht im Export enthalten');
      continue;
    }
    if (seenCocktails.has(decision.exportId)) issue('Mehrfach zugeordnet');
    seenCocktails.add(decision.exportId);
    if (decision.decision === 'skip') continue;
    if (decision.decision === 'rename' && !decision.newName) issue('Kein neuer Name angegeben');
    if (decision.decision === 'overwrite') {
      if (!decision.overwriteId) issue('Kein zu überschreibender Cocktail ausgewählt');
      else if (seenOverwrites.has(decision.overwriteId)) issue('Ziel-Cocktail wird mehrfach überschrieben');
      else seenOverwrites.add(decision.overwriteId);
    }

    // Every dependency the cocktail references needs a mapping decision.
    const missing = (kind: EntityKind, id: string | null | undefined) => {
      if (id && !decided[kind].has(id)) {
        const name = (dump[kind] as DumpEntity[]).find((entity) => entity.id === id)?.name ?? id;
        issue(`Keine Zuordnung für ${ENTITY_LABELS[kind]} "${name}"`);
      }
    };
    missing('glasses', cocktail.glassId);
    missing('ice', cocktail.iceId);
    const steps = dump.cocktailRecipeSteps.filter((step) => step.cocktailRecipeId === cocktail.id);
    const stepIds = new Set(steps.map((step) => step.id));
    for (const step of steps) missing('stepActions', step.actionId);
    for (const line of dump.cocktailRecipeIngredients.filter((ing) => stepIds.has(ing.cocktailRecipeStepId))) {
      missing('ingredients', line.ingredientId);
      missing('units', line.unitId);
    }
    for (const garnish of dump.cocktailRecipeGarnishes.filter((g) => g.cocktailRecipeId === cocktail.id)) missing('garnishes', garnish.garnishId);
  }

  return issues;
}

/** "use-existing" ids and overwrite targets must belong to the caller's workspace. */
async function validateDecisionScope(tx: Tx, workspaceId: string, dump: CocktailImportDump, decisions: CocktailImportMappingDecisions) {
  const issues: ImportIssue[] = [];
  const missingIds = async (entity: ScopedEntity, ids: string[]): Promise<Set<string>> => {
    try {
      await assertIdsInWorkspace(tx, workspaceId, { [entity]: ids });
      return new Set();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'INVALID_REFERENCE') throw error;
      return new Set((error.issues as Array<{ ids: string[] }>).flatMap((entry) => entry.ids));
    }
  };

  for (const kind of ENTITY_KINDS) {
    const useExisting = decisions[kind].filter((decision) => decision.decision === 'use-existing' && decision.existingId);
    const missing = await missingIds(
      ENTITY_SCOPE[kind],
      useExisting.map((decision) => decision.existingId!),
    );
    for (const decision of useExisting.filter((d) => missing.has(d.existingId!))) {
      const name = (dump[kind] as DumpEntity[]).find((entity) => entity.id === decision.exportId)?.name ?? decision.exportId;
      issues.push({ step: kind, entityType: ENTITY_LABELS[kind], entityName: name, error: 'Ausgewählter Eintrag existiert nicht in diesem Workspace' });
    }
  }

  const overwrites = decisions.cocktails.filter((decision) => decision.decision === 'overwrite' && decision.overwriteId);
  const missingCocktails = await missingIds(
    'cocktail',
    overwrites.map((decision) => decision.overwriteId!),
  );
  for (const decision of overwrites.filter((d) => missingCocktails.has(d.overwriteId!))) {
    const name = dump.cocktailRecipes.find((cocktail) => cocktail.id === decision.exportId)?.name ?? decision.exportId;
    issues.push({ step: 'cocktails', entityType: 'Cocktail', entityName: name, error: 'Zu überschreibender Cocktail existiert nicht in diesem Workspace' });
  }

  return issues;
}

const importAuditInclude = {
  ice: true,
  glass: true,
  garnishes: { include: { garnish: true } },
  steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
  CocktailRecipeImage: true,
} satisfies Prisma.CocktailRecipeInclude;

interface ImportCounts {
  imported: { cocktails: number; glasses: number; garnishes: number; ingredients: number; units: number; ice: number; stepActions: number };
  created: { glasses: number; garnishes: number; ingredients: number; units: number; ice: number; stepActions: number };
  warnings: ImportIssue[];
}

async function executeImport(
  tx: Tx,
  workspaceId: string,
  user: User,
  dump: CocktailImportDump,
  decisions: CocktailImportMappingDecisions,
): Promise<ImportCounts> {
  // Imports find-or-create dependencies by name: serialize them per workspace.
  await lockWorkspaceScope(tx, workspaceId, 'cocktail-import');

  const scopeIssues = await validateDecisionScope(tx, workspaceId, dump, decisions);
  if (scopeIssues.length > 0) throw new ImportValidationError(scopeIssues);

  const counts: ImportCounts = {
    imported: { cocktails: 0, glasses: 0, garnishes: 0, ingredients: 0, units: 0, ice: 0, stepActions: 0 },
    created: { glasses: 0, garnishes: 0, ingredients: 0, units: 0, ice: 0, stepActions: 0 },
    warnings: [],
  };
  const mapping = Object.fromEntries(ENTITY_KINDS.map((kind) => [kind, new Map<string, string>()])) as Record<EntityKind, Map<string, string>>;
  const translations: Array<{ key: string; labelDe?: string | null; labelEn?: string | null }> = [];

  type NewEntity<K extends EntityKind> = CocktailImportDump[K][number] & ImportEntityData & { name: string };

  /** Maps `use-existing` decisions directly; `create-new` ones get the export entity merged with the wizard's edits. */
  const resolve = async <K extends EntityKind>(kind: K, create: (data: NewEntity<K>, exportId: string, edits: ImportEntityData) => Promise<string>) => {
    for (const decision of decisions[kind]) {
      if (decision.decision === 'use-existing') {
        mapping[kind].set(decision.exportId, decision.existingId!);
        continue;
      }
      const exported = (dump[kind] as Array<CocktailImportDump[K][number] & DumpEntity>).find((entity) => entity.id === decision.exportId)!;
      const edits = decision.newEntityData ?? {};
      const data = { ...exported, ...edits, name: (edits.name ?? exported.name).trim() } as NewEntity<K>;
      mapping[kind].set(decision.exportId, await create(data, decision.exportId, edits));
    }
  };

  const reuse = (kind: EntityKind, entityName: string, existingId: string) => {
    counts.warnings.push({ step: kind, entityType: ENTITY_LABELS[kind], entityName, error: 'Existiert bereits – bestehender Eintrag wird verwendet' });
    return existingId;
  };
  const addLabels = (key: string, edits: ImportEntityData) => {
    const labelDe = edits.labelDe ?? edits.lableDE;
    if (labelDe || edits.labelEn) translations.push({ key, labelDe, labelEn: edits.labelEn });
  };

  await resolve('units', async (data, exportId, edits) => {
    const existing = await tx.unit.findFirst({ where: { name: data.name, workspaceId }, select: { id: true } });
    if (existing) return reuse('units', data.name, existing.id);
    const created = await tx.unit.create({ data: { name: data.name, workspaceId } });
    addLabels(data.name, edits);
    counts.created.units++;
    return created.id;
  });

  await resolve('ice', async (data, exportId, edits) => {
    const existing = await tx.ice.findFirst({ where: { name: data.name, workspaceId }, select: { id: true } });
    if (existing) return reuse('ice', data.name, existing.id);
    const created = await tx.ice.create({ data: { name: data.name, workspaceId } });
    addLabels(data.name, edits);
    counts.created.ice++;
    return created.id;
  });

  await resolve('stepActions', async (data, exportId, edits) => {
    const actionGroup = data.actionGroup ?? '';
    const existing = await tx.workspaceCocktailRecipeStepAction.findFirst({ where: { name: data.name, actionGroup, workspaceId }, select: { id: true } });
    if (existing) return reuse('stepActions', `${data.name} (${actionGroup})`, existing.id);
    // The wizard only sends edited fields, so take the dilution from the exported action.
    const exported = dump.stepActions.find((action) => action.id === exportId);
    const created = await tx.workspaceCocktailRecipeStepAction.create({
      data: { name: data.name, actionGroup, workspaceId, dilutionPercent: parsePercent(exported?.dilutionPercent) },
    });
    addLabels(data.name, edits);
    counts.created.stepActions++;
    return created.id;
  });

  await resolve('glasses', async (data, exportId) => {
    const existing = await tx.glass.findFirst({ where: { name: data.name, workspaceId }, select: { id: true } });
    if (existing) return reuse('glasses', data.name, existing.id);
    const created = await tx.glass.create({
      data: { name: data.name, workspaceId, deposit: data.deposit ?? 0, volume: data.volume ?? null, notes: data.notes ?? null },
    });
    const image = dump.glassImages.find((img) => img.glassId === exportId);
    if (image) await tx.glassImage.create({ data: { glassId: created.id, image: image.image } });
    const full = await tx.glass.findUniqueOrThrow({ where: { id: created.id }, include: { GlassImage: true } });
    await createLog(tx, workspaceId, user.id, 'Glass', created.id, 'CREATE', null, full);
    counts.created.glasses++;
    return created.id;
  });

  await resolve('garnishes', async (data, exportId) => {
    const existing = await tx.garnish.findFirst({ where: { name: data.name, workspaceId }, select: { id: true } });
    if (existing) return reuse('garnishes', data.name, existing.id);
    const created = await tx.garnish.create({
      data: {
        name: data.name,
        workspaceId,
        description: data.description ?? null,
        notes: data.notes ?? null,
        price: data.price ?? null,
        ...garnishGuestInfoImportData(data),
      },
    });
    const image = dump.garnishImages.find((img) => img.garnishId === exportId);
    if (image) await tx.garnishImage.create({ data: { garnishId: created.id, image: image.image } });
    const full = await tx.garnish.findUniqueOrThrow({ where: { id: created.id }, include: { GarnishImage: true } });
    await createLog(tx, workspaceId, user.id, 'Garnish', created.id, 'CREATE', null, full);
    counts.created.garnishes++;
    return created.id;
  });

  await resolve('ingredients', async (data, exportId) => {
    const existing = await tx.ingredient.findFirst({ where: { name: data.name, workspaceId }, select: { id: true } });
    if (existing) return reuse('ingredients', data.name, existing.id);
    const created = await tx.ingredient.create({
      data: {
        name: data.name,
        workspaceId,
        shortName: data.shortName ?? null,
        description: data.description ?? null,
        notes: data.notes ?? null,
        price: data.price ?? null,
        link: data.link ?? null,
        tags: data.tags ?? [],
        ...ingredientGuestInfoImportData(data),
      },
    });
    const image = dump.ingredientImages.find((img) => img.ingredientId === exportId);
    if (image) await tx.ingredientImage.create({ data: { ingredientId: created.id, image: image.image } });

    const seenUnits = new Set<string>();
    for (const volume of dump.ingredientVolumes.filter((vol) => vol.ingredientId === exportId)) {
      const unitId = mapping.units.get(volume.unitId);
      if (!unitId || seenUnits.has(unitId)) continue;
      seenUnits.add(unitId);
      await tx.ingredientVolume.create({ data: { ingredientId: created.id, unitId, volume: volume.volume, workspaceId } });
    }

    const full = await tx.ingredient.findUniqueOrThrow({
      where: { id: created.id },
      include: { IngredientVolume: { include: { unit: true } }, IngredientImage: true },
    });
    await createLog(tx, workspaceId, user.id, 'Ingredient', created.id, 'CREATE', null, full);
    counts.created.ingredients++;
    return created.id;
  });

  for (const decision of decisions.cocktails) {
    if (decision.decision === 'skip') continue;
    const exported = dump.cocktailRecipes.find((cocktail) => cocktail.id === decision.exportId)!;
    const name = decision.decision === 'rename' && decision.newName ? decision.newName : exported.name;
    const data = {
      name,
      glassId: exported.glassId ? mapping.glasses.get(exported.glassId)! : null,
      iceId: exported.iceId ? mapping.ice.get(exported.iceId)! : null,
      price: exported.price ?? null,
      tags: exported.tags ?? [],
      description: exported.description ?? null,
      isArchived: exported.isArchived ?? false,
      history: exported.history ?? null,
      notes: exported.notes ?? null,
      ...cocktailGuestInfoImportData(exported),
    };

    let cocktailId: string;
    let oldCocktail: Prisma.CocktailRecipeGetPayload<{ include: typeof importAuditInclude }> | null = null;
    if (decision.decision === 'overwrite') {
      // Overwrite in place: replace the recipe content but keep the row (ratings,
      // statistics, card entries stay attached). The target was scoped above.
      cocktailId = decision.overwriteId!;
      oldCocktail = await tx.cocktailRecipe.findFirstOrThrow({ where: { id: cocktailId, workspaceId }, include: importAuditInclude });
      await tx.cocktailRecipeIngredient.deleteMany({ where: { cocktailRecipeStep: { cocktailRecipeId: cocktailId } } });
      await tx.cocktailRecipeGarnish.deleteMany({ where: { cocktailRecipeId: cocktailId } });
      await tx.cocktailRecipeStep.deleteMany({ where: { cocktailRecipeId: cocktailId } });
      await tx.cocktailRecipeImage.deleteMany({ where: { cocktailRecipeId: cocktailId } });
      await tx.cocktailRecipe.update({ where: { id: cocktailId, workspaceId }, data });
    } else {
      cocktailId = (await tx.cocktailRecipe.create({ data: { ...data, workspaceId } })).id;
    }
    counts.imported.cocktails++;

    const image = dump.cocktailRecipeImages.find((img) => img.cocktailRecipeId === decision.exportId);
    if (image) await tx.cocktailRecipeImage.create({ data: { cocktailRecipeId: cocktailId, image: image.image } });

    const steps = dump.cocktailRecipeSteps.filter((step) => step.cocktailRecipeId === decision.exportId);
    const stepMapping = new Map<string, string>();
    for (const step of steps) {
      const created = await tx.cocktailRecipeStep.create({
        data: {
          cocktailRecipeId: cocktailId,
          stepNumber: step.stepNumber,
          actionId: mapping.stepActions.get(step.actionId)!,
          optional: step.optional ?? false,
        },
      });
      stepMapping.set(step.id, created.id);
    }

    for (const line of dump.cocktailRecipeIngredients) {
      const stepId = stepMapping.get(line.cocktailRecipeStepId);
      if (!stepId) continue;
      await tx.cocktailRecipeIngredient.create({
        data: {
          cocktailRecipeStepId: stepId,
          ingredientId: line.ingredientId ? mapping.ingredients.get(line.ingredientId)! : null,
          unitId: line.unitId ? mapping.units.get(line.unitId)! : null,
          ingredientNumber: line.ingredientNumber,
          optional: line.optional ?? false,
          amount: line.amount ?? null,
        },
      });
    }

    // Several exported garnishes may map onto the same existing one; a cocktail holds each garnish once.
    const garnishIds = new Set<string>();
    for (const garnish of dump.cocktailRecipeGarnishes.filter((g) => g.cocktailRecipeId === decision.exportId)) {
      const garnishId = mapping.garnishes.get(garnish.garnishId)!;
      if (garnishIds.has(garnishId)) continue;
      garnishIds.add(garnishId);
      await tx.cocktailRecipeGarnish.create({
        data: {
          cocktailRecipeId: cocktailId,
          garnishId,
          garnishNumber: garnish.garnishNumber,
          optional: garnish.optional ?? false,
          isAlternative: garnish.isAlternative ?? false,
          description: garnish.description ?? null,
        },
      });
    }

    const full = await tx.cocktailRecipe.findUniqueOrThrow({ where: { id: cocktailId }, include: importAuditInclude });
    if (oldCocktail) await createCocktailRecipeAuditLog(tx, workspaceId, user.id, cocktailId, 'UPDATE', oldCocktail, full);
    else await createCocktailRecipeAuditLog(tx, workspaceId, user.id, cocktailId, 'CREATE', null, full);
  }

  if (translations.length > 0) {
    // Same lock scope as lib/translations/workspaceTranslations.ts: read-merge-write of the JSON blob.
    await lockWorkspaceScope(tx, workspaceId, 'workspace-translations');
    const setting = await tx.workspaceSetting.findFirst({ where: { workspaceId, setting: 'translations' } });
    const merged = parseTranslations(setting?.value, {});
    for (const { key, labelDe, labelEn } of translations) {
      if (labelDe) (merged.de ??= {})[key] = labelDe;
      if (labelEn) (merged.en ??= {})[key] = labelEn;
    }
    const value = JSON.stringify(merged);
    await tx.workspaceSetting.upsert({
      where: { workspaceId_setting: { setting: 'translations', workspaceId } },
      create: { workspaceId, setting: 'translations', value },
      update: { value },
    });
  }

  return counts;
}

function dumpValidationResult(issues: z.core.$ZodIssue[]): PortingResult {
  const importIssues = zodIssuesToImportIssues('exportData', issues);
  return {
    status: 400,
    body: {
      valid: false,
      ...portingError('INVALID_IMPORT', 'Invalid JSON structure', { issues: importIssues }),
      errors: importIssues.map((issue) => `${issue.entityName}: ${issue.error}`),
    },
  };
}

export async function importCocktailsJson(
  workspace: Workspace,
  user: User,
  input: CocktailImportJsonInput,
  apiKeyPermissions: RequestApiKeyPermissions | null = null,
): Promise<PortingResult> {
  const workspaceId = workspace.id;
  const parsedDump = CocktailImportDumpSchema.safeParse(input.exportData);

  if (input.phase === 'validate') {
    if (!parsedDump.success) return dumpValidationResult(parsedDump.error.issues);
    return {
      status: 200,
      body: {
        valid: true,
        cocktailCount: parsedDump.data.cocktailRecipes.length,
        cocktails: parsedDump.data.cocktailRecipes.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }

  if (!parsedDump.success) return invalidImport('Invalid JSON structure', zodIssuesToImportIssues('exportData', parsedDump.error.issues));
  const dump = parsedDump.data;

  if (input.phase === 'prepare-mapping') {
    return { status: 200, body: await prepareImportMapping(workspaceId, dump) };
  }

  if (input.mappingDecisions == undefined) {
    return { status: 400, body: portingError('VALIDATION_ERROR', 'Mapping-Entscheidungen fehlen') };
  }
  const parsedDecisions = CocktailImportMappingDecisionsSchema.safeParse(input.mappingDecisions);
  if (!parsedDecisions.success) {
    return invalidImport('Invalid mapping decisions', zodIssuesToImportIssues('mappingDecisions', parsedDecisions.error.issues));
  }
  const decisions = parsedDecisions.data;

  // Overwriting replaces existing recipes, which is an update.
  const overwrites = decisions.cocktails.some((decision) => decision.decision === 'overwrite');
  if (overwrites && apiKeyPermissions && apiKeyPermissions !== 'all' && !apiKeyPermissions.includes(Permission.COCKTAILS_UPDATE)) {
    return { status: 403, body: portingError('FORBIDDEN', 'API key does not have required permission COCKTAILS_UPDATE') };
  }

  const issues = validateDecisions(dump, decisions);
  if (issues.length > 0) return invalidImport('Import ist ungültig – es wurde nichts importiert', issues);

  try {
    const { warnings, ...counts } = await runTx((tx) => executeImport(tx, workspaceId, user, dump, decisions), { timeout: BULK_TX_TIMEOUT_MS });
    return { status: 200, body: { success: true, ...counts, ...(warnings.length > 0 && { warnings }) } };
  } catch (error) {
    if (error instanceof ImportValidationError) return invalidImport('Import ist ungültig – es wurde nichts importiert', error.issues);
    const apiError = prismaErrorToApiError(error);
    if (apiError) {
      return { status: apiError.status, body: portingError(apiError.code, `Import fehlgeschlagen – es wurde nichts importiert (${apiError.message})`) };
    }
    throw error;
  }
}

async function prepareImportMapping(workspaceId: string, dump: CocktailImportDump) {
  const existingGlasses = await prisma.glass.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingGarnishes = await prisma.garnish.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingIngredients = await prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingUnits = await prisma.unit.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingIce = await prisma.ice.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingStepActions = await prisma.workspaceCocktailRecipeStepAction.findMany({
    where: { workspaceId },
    select: { id: true, name: true, actionGroup: true },
  });
  const existingCocktails = await prisma.cocktailRecipe.findMany({ where: { workspaceId }, select: { id: true, name: true } });

  const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const autoMap = (entities: Array<{ id: string; name: string; actionGroup?: unknown }>, existing: Array<{ id: string; name: string; actionGroup?: string }>) =>
    entities.map((entity) => {
      const match = existing.find((e) => sameName(e.name, entity.name) && (e.actionGroup === undefined || e.actionGroup === entity.actionGroup));
      return match
        ? { exportId: entity.id, decision: 'use-existing' as const, existingId: match.id }
        : { exportId: entity.id, decision: 'create-new' as const };
    });

  return {
    existingMatches: {
      glasses: dump.glasses.map((g) => ({
        exportId: g.id,
        exportName: g.name,
        matches: existingGlasses.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
      })),
      garnishes: dump.garnishes.map((g) => ({
        exportId: g.id,
        exportName: g.name,
        matches: existingGarnishes.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
      })),
      ingredients: dump.ingredients.map((i) => ({
        exportId: i.id,
        exportName: i.name,
        matches: existingIngredients.filter((e) => e.name.toLowerCase().includes(i.name.toLowerCase())),
      })),
      units: dump.units.map((u) => ({ exportId: u.id, exportName: u.name, matches: existingUnits.filter((e) => sameName(e.name, u.name)) })),
      ice: dump.ice.map((i) => ({ exportId: i.id, exportName: i.name, matches: existingIce.filter((e) => sameName(e.name, i.name)) })),
      stepActions: dump.stepActions.map((a) => ({
        exportId: a.id,
        exportName: a.name,
        matches: existingStepActions.filter((e) => sameName(e.name, a.name) && e.actionGroup === a.actionGroup),
      })),
    },
    autoMappings: {
      glasses: autoMap(dump.glasses, existingGlasses),
      garnishes: autoMap(dump.garnishes, existingGarnishes),
      ingredients: autoMap(dump.ingredients, existingIngredients),
      units: autoMap(dump.units, existingUnits),
      ice: autoMap(dump.ice, existingIce),
      stepActions: autoMap(dump.stepActions, existingStepActions),
    },
    cocktailConflicts: dump.cocktailRecipes.map((expCocktail) => ({
      exportId: expCocktail.id,
      exportName: expCocktail.name,
      conflicts: existingCocktails.filter((existing) => sameName(existing.name, expCocktail.name)).map((c) => ({ id: c.id, name: c.name })),
    })),
  };
}
