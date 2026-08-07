/**
 * Version-agnostic business logic for cocktail export/import (JSON + PDF).
 *
 * IMPORTANT round-trip contract: the JSON export/import payloads are a raw data
 * dump that must re-import losslessly. These controllers therefore faithfully
 * replicate the legacy handlers' DB reads/writes and return the EXACT same data
 * shapes (see types/CocktailExportStructure.ts) — they intentionally do NOT map
 * to the clean public DTOs used elsewhere. The v1 route handlers write these
 * results verbatim (no `{ data }` envelope) to preserve the historic format.
 */
import prisma from '../../../prisma/prisma';
import React from 'react';
import { renderToString } from 'react-dom/server';
import puppeteer, { Browser } from 'puppeteer-core';
import { promises as dnsPromises } from 'dns';
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { $Enums, Prisma } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import { createCocktailRecipeAuditLog } from '@lib/auditLog';
import { buildCocktailPdfLabels, CocktailPdfPage } from '@components/pdf/CocktailPdfPage';
import { getServerT } from '@lib/i18n/server';
import { normalizeLocale, type AppLocale } from '@lib/i18n/locales';
import { toIntlLocale } from '@lib/i18n/format';
import { pdfExportTailwindConfigScript, pdfExportThemeStyles } from '@lib/pdf/pdfExportStyles';
import { CocktailExportStructure } from '../../../types/CocktailExportStructure';
import packageJson from '../../../package.json';

const WorkspaceSettingKey = $Enums.WorkspaceSettingKey;

/** Result signalled back to the (hand-wired) route handler, mirroring the legacy status/body. */
export type PortingResult = { status: number; body: unknown };

// ---------------------------------------------------------------------------
// Export JSON — faithful replica of pages/api/.../cocktails/export-json.tsx
// ---------------------------------------------------------------------------

export async function exportCocktailsJson(workspace: Workspace, cocktailIds: string[]): Promise<PortingResult> {
  const workspaceId = workspace.id;

  if (!cocktailIds || cocktailIds.length === 0) {
    return { status: 400, body: { message: 'No cocktails selected' } };
  }

  try {
    const cocktailRecipes = await prisma.cocktailRecipe.findMany({
      where: { id: { in: cocktailIds }, workspaceId },
    });

    if (cocktailRecipes.length === 0) {
      return { status: 404, body: { message: 'No cocktails found' } };
    }

    const cocktailRecipeImages = await prisma.cocktailRecipeImage.findMany({
      where: { cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) } },
    });

    const cocktailRecipeSteps = await prisma.cocktailRecipeStep.findMany({
      where: { cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) } },
    });

    const cocktailRecipeGarnishes = await prisma.cocktailRecipeGarnish.findMany({
      where: { cocktailRecipeId: { in: cocktailRecipes.map((r) => r.id) } },
    });

    const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.findMany({
      where: { cocktailRecipeStepId: { in: cocktailRecipeSteps.map((s) => s.id) } },
    });

    const glassIds = Array.from(new Set(cocktailRecipes.map((r) => r.glassId).filter(Boolean))) as string[];
    const iceIds = Array.from(new Set(cocktailRecipes.map((r) => r.iceId).filter(Boolean))) as string[];
    const garnishIds = Array.from(new Set(cocktailRecipeGarnishes.map((g) => g.garnishId).filter(Boolean))) as string[];
    const ingredientIds = Array.from(new Set(cocktailRecipeIngredients.map((i) => i.ingredientId).filter(Boolean))) as string[];
    const stepActionIds = Array.from(new Set(cocktailRecipeSteps.map((s) => s.actionId).filter(Boolean))) as string[];

    const glasses = await prisma.glass.findMany({ where: { id: { in: glassIds } } });
    const glassImages = await prisma.glassImage.findMany({ where: { glassId: { in: glassIds } } });
    const ice = await prisma.ice.findMany({ where: { id: { in: iceIds } } });
    const garnishes = await prisma.garnish.findMany({ where: { id: { in: garnishIds } } });
    const garnishImages = await prisma.garnishImage.findMany({ where: { garnishId: { in: garnishIds } } });
    const ingredients = await prisma.ingredient.findMany({ where: { id: { in: ingredientIds } } });
    const ingredientImages = await prisma.ingredientImage.findMany({ where: { ingredientId: { in: ingredientIds } } });
    const ingredientVolumes = await prisma.ingredientVolume.findMany({ where: { ingredientId: { in: ingredientIds } } });
    const stepActions = await prisma.workspaceCocktailRecipeStepAction.findMany({ where: { id: { in: stepActionIds } } });

    const unitIds = Array.from(
      new Set([...ingredientVolumes.map((v) => v.unitId), ...cocktailRecipeIngredients.map((i) => i.unitId)].filter(Boolean) as string[]),
    );

    const units = await prisma.unit.findMany({ where: { id: { in: unitIds } } });

    const exportData: CocktailExportStructure = {
      exportVersion: packageJson.version,
      exportDate: new Date().toISOString(),
      exportedFrom: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      },
      cocktailRecipes,
      cocktailRecipeImages,
      cocktailRecipeSteps,
      cocktailRecipeGarnishes,
      cocktailRecipeIngredients,
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

    return { status: 200, body: exportData };
  } catch (error) {
    console.error('Export error:', error);
    return { status: 500, body: { message: 'Failed to export cocktails' } };
  }
}

// ---------------------------------------------------------------------------
// Export PDF — faithful replica of pages/api/.../cocktails/export-pdf.tsx
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

export interface CocktailPdfOptions {
  cocktailIds: string[];
  exportImage?: boolean;
  exportDescription?: boolean;
  exportNotes?: boolean;
  exportHistory?: boolean;
  newPagePerCocktail?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  /** UI locale for PDF chrome labels (defaults to `de`). */
  locale?: AppLocale | string;
}

/** Discriminated result: either a rendered PDF or a JSON error mirroring the legacy status codes. */
export type CocktailPdfResult = { kind: 'pdf'; buffer: Buffer } | { kind: 'error'; status: number; body: unknown };

async function generatePdf(html: string, numberOfCocktails: number, showHeader = false, showFooter = false, locale: AppLocale = 'de'): Promise<Buffer> {
  const chromiumHost = process.env.CHROMIUM_HOST;
  console.debug('chromiumHost', chromiumHost);

  const timeoutMs = Math.max(10000 * numberOfCocktails, 30000);
  console.debug(`Setting timeout to ${timeoutMs}ms for ${numberOfCocktails} cocktails`);

  let browser: Browser | undefined;
  try {
    if (chromiumHost && chromiumHost !== 'localhost' && chromiumHost !== '127.0.0.1') {
      console.debug('Fetching WebSocket URL from Chromium...');
      try {
        const { address: chromeIP } = await dnsPromises.lookup(chromiumHost);
        console.debug('Chromium IP:', chromeIP);
        const browserURL = `http://${chromeIP}:9222`;
        console.debug('Connecting to Chromium via browserURL:', browserURL);
        browser = await puppeteer.connect({ browserURL });
        console.debug('Successfully connected via DNS-resolved IP');
      } catch (dnsError) {
        console.error('DNS lookup failed, trying hostname directly:', dnsError);
        const browserURL = `http://${chromiumHost}:9222`;
        browser = await puppeteer.connect({ browserURL });
        console.debug('Successfully connected via hostname');
      }
    } else if (chromiumHost === 'localhost' || chromiumHost === '127.0.0.1') {
      console.debug('Connecting to localhost Chromium');
      browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
      console.debug('Successfully connected to localhost');
    } else {
      console.debug('No Chromium host specified, launching local Chromium - assuming it is installed at the instance');
      browser = await puppeteer.launch();
    }

    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    await page.addScriptTag({ url: 'https://cdn.tailwindcss.com' });
    await page.addScriptTag({ content: pdfExportTailwindConfigScript });

    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });

    await page.evaluate(() => {
      document.body.style.backgroundColor = 'white';
      document.documentElement.style.backgroundColor = 'white';
    });

    const renderWaitTime = Math.min(3000 + numberOfCocktails * 500, 10000);
    console.debug(`Waiting ${renderWaitTime}ms for rendering to complete`);
    await new Promise((resolve) => setTimeout(resolve, renderWaitTime));

    await page.evaluate(() => {
      void document.body.offsetHeight;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`PDF generation timed out after ${timeoutMs}ms for ${numberOfCocktails} cocktails`));
      }, timeoutMs);
    });

    let pdfBuffer: Buffer;
    try {
      const currentDate = new Date();
      const { t } = getServerT(locale);
      const formattedDate = currentDate.toLocaleDateString(toIntlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric' });
      const pageLabel = t('cocktail:pdfPageLabel');

      const headerTemplate = showHeader
        ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 5mm;">
            <div style="flex: 1;"></div>
            <div style="flex: 1; text-align: center;">Cocktail-Manager Export</div>
            <div style="flex: 1; text-align: right;">${formattedDate}</div>
          </div>`
        : '<div></div>';

      const footerTemplate = showFooter
        ? `<div style="font-size: 8pt; color: rgba(0, 0, 0, 0.6); width: 100%; text-align: center; padding: 0 5mm;">
            ${pageLabel} <span class="pageNumber"></span>
          </div>`
        : '<div></div>';

      pdfBuffer = (await Promise.race([
        page.pdf({
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
        }),
        timeoutPromise,
      ])) as Buffer;
    } catch (pdfError) {
      console.error('PDF generation error details:', { error: pdfError, numberOfCocktails, htmlLength: html.length, timeoutMs });
      try {
        const pageInfo = await page.evaluate(() => ({
          bodyHeight: document.body?.scrollHeight || 0,
          bodyWidth: document.body?.scrollWidth || 0,
          pageCount: document.querySelectorAll('.pdf-page').length,
        }));
        console.error('Page state at error:', pageInfo);
      } catch (infoError) {
        console.error('Could not get page info:', infoError);
      }
      throw pdfError;
    }

    await page.close();
    await browser.disconnect();
    console.debug('Browser connection closed after PDF generation');

    return Buffer.from(pdfBuffer);
  } catch (error) {
    if (browser) {
      try {
        await browser.disconnect();
        console.debug('Browser connection closed after error');
      } catch (disconnectError) {
        console.error('Error disconnecting browser:', disconnectError);
      }
    }
    throw error;
  }
}

function getTranslation(translations: Record<string, Record<string, string>>, key: string, language: string = 'de'): string {
  return translations[language]?.[key] ?? translations['de']?.[key] ?? key;
}

function generateHtmlForCocktails(
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
  },
): string {
  const { t } = getServerT(options.locale);
  const labels = buildCocktailPdfLabels(t);
  const pages = cocktails.map((cocktail, index) => {
    console.log('Rendering cocktail', cocktail.name);
    const imageBase64 = options.exportImage ? cocktail.CocktailRecipeImage?.[0]?.image || null : null;
    const componentHtml = renderToString(
      React.createElement(CocktailPdfPage, {
        cocktail,
        imageBase64,
        getTranslation: (key: string) => getTranslation(translations, key, options.locale),
        labels,
        locale: options.locale,
        exportImage: options.exportImage,
        exportDescription: options.exportDescription,
        exportNotes: options.exportNotes,
        exportHistory: options.exportHistory,
      }),
    );
    const pageBreakClass = options.newPagePerCocktail ? 'pdf-page' : 'pdf-page-no-break';
    return `<div class="${pageBreakClass}" data-cocktail-id="${cocktail.id}" data-cocktail-index="${index}" data-cocktail-name="${cocktail.name}">${componentHtml}</div>`;
  });

  const footerHtml = '';

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
<html lang="${options.locale}">
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
  ${footerHtml}
  <script>
    (function() {
      // Headers are now rendered per cocktail block, so no JavaScript needed
      // Footer page numbers are handled by Puppeteer's displayHeaderFooter
    })();
  </script>
</body>
</html>`;
}

export async function exportCocktailsPdf(workspace: Workspace, options: CocktailPdfOptions): Promise<CocktailPdfResult> {
  try {
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

    if (!cocktailIds || !Array.isArray(cocktailIds) || cocktailIds.length === 0) {
      return { kind: 'error', status: 400, body: { message: 'cocktailIds array is required and must not be empty' } };
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
      return { kind: 'error', status: 404, body: { message: 'No cocktails found' } };
    }

    if (!process.env.CHROMIUM_HOST) {
      return { kind: 'error', status: 503, body: { message: 'PDF export service is not configured' } };
    }

    const translationSetting = await prisma.workspaceSetting.findFirst({
      where: { workspaceId: workspace.id, setting: WorkspaceSettingKey.translations },
    });

    const translations: Record<string, Record<string, string>> = translationSetting?.value ? JSON.parse(translationSetting.value) : { de: {} };

    const batchSize = 10;
    const batches: CocktailRecipeWithDetails[][] = [];
    for (let i = 0; i < cocktails.length; i += batchSize) {
      batches.push(cocktails.slice(i, i + batchSize));
    }

    console.log(`Generating PDF in ${batches.length} batches of max ${batchSize} cocktails each`);

    const pdfBuffers: Buffer[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} cocktails`);
      const html = generateHtmlForCocktails(batch, translations, {
        exportImage,
        exportDescription,
        exportNotes,
        exportHistory,
        newPagePerCocktail,
        showHeader,
        showFooter,
        locale,
      });
      const batchPdfBuffer = await generatePdf(html, batch.length, showHeader, showFooter, locale);
      pdfBuffers.push(batchPdfBuffer);
      console.log(`Batch ${i + 1}/${batches.length} completed successfully`);
    }

    console.log(`Merging ${pdfBuffers.length} PDF batches`);
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
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        return { kind: 'error', status: 503, body: { message: 'Chromium service is not available' } };
      }
      return { kind: 'error', status: 500, body: { message: `PDF generation failed: ${error.message}` } };
    }
    return { kind: 'error', status: 500, body: { message: 'PDF generation failed' } };
  }
}

// ---------------------------------------------------------------------------
// Import JSON — faithful replica of pages/api/.../cocktails/import-json.tsx
// ---------------------------------------------------------------------------

interface ImportEntityData {
  id?: string;
  name: string;
  workspaceId?: string;
  actionGroup?: string;
  labelDe?: string;
  labelEn?: string;
  /** @deprecated Prefer labelDe */
  lableDE?: string;
  deposit?: number | null;
  volume?: number | null;
  notes?: string | null;
  description?: string | null;
  price?: number | null;
  link?: string | null;
  shortName?: string | null;
  tags?: string[];
}

interface EntityMapping {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: ImportEntityData;
}

interface CocktailMapping {
  exportId: string;
  decision: 'import' | 'skip' | 'rename' | 'overwrite';
  newName?: string;
  overwriteId?: string;
}

interface MappingDecisions {
  glasses: EntityMapping[];
  garnishes: EntityMapping[];
  ingredients: EntityMapping[];
  units: EntityMapping[];
  ice: EntityMapping[];
  stepActions: EntityMapping[];
  cocktails: CocktailMapping[];
}

export async function importCocktailsJson(
  workspace: Workspace,
  user: User,
  input: { phase: 'validate' | 'prepare-mapping' | 'execute'; exportData: CocktailExportStructure; mappingDecisions?: MappingDecisions },
): Promise<PortingResult> {
  const workspaceId = workspace.id;
  const { phase, exportData, mappingDecisions } = input;

  try {
    if (phase === 'validate') {
      if (!exportData || !exportData.exportVersion || !exportData.cocktailRecipes) {
        return { status: 400, body: { valid: false, errors: ['Invalid JSON structure'] } };
      }

      return {
        status: 200,
        body: {
          valid: true,
          cocktailCount: exportData.cocktailRecipes.length,
          cocktails: exportData.cocktailRecipes.map((c) => ({ id: c.id, name: c.name })),
        },
      };
    }

    if (phase === 'prepare-mapping') {
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

      const autoMatchGlasses: EntityMapping[] = [];
      const autoMatchGarnishes: EntityMapping[] = [];
      const autoMatchIngredients: EntityMapping[] = [];
      const autoMatchUnits: EntityMapping[] = [];
      const autoMatchIce: EntityMapping[] = [];
      const autoMatchStepActions: EntityMapping[] = [];

      exportData.glasses.forEach((glass) => {
        const match = existingGlasses.find((e) => e.name.toLowerCase() === glass.name.toLowerCase());
        autoMatchGlasses.push(match ? { exportId: glass.id, decision: 'use-existing', existingId: match.id } : { exportId: glass.id, decision: 'create-new' });
      });

      exportData.garnishes.forEach((garnish) => {
        const match = existingGarnishes.find((e) => e.name.toLowerCase() === garnish.name.toLowerCase());
        autoMatchGarnishes.push(
          match ? { exportId: garnish.id, decision: 'use-existing', existingId: match.id } : { exportId: garnish.id, decision: 'create-new' },
        );
      });

      exportData.ingredients.forEach((ingredient) => {
        const match = existingIngredients.find((e) => e.name.toLowerCase() === ingredient.name.toLowerCase());
        autoMatchIngredients.push(
          match ? { exportId: ingredient.id, decision: 'use-existing', existingId: match.id } : { exportId: ingredient.id, decision: 'create-new' },
        );
      });

      exportData.units.forEach((unit) => {
        const match = existingUnits.find((e) => e.name.toLowerCase() === unit.name.toLowerCase());
        autoMatchUnits.push(match ? { exportId: unit.id, decision: 'use-existing', existingId: match.id } : { exportId: unit.id, decision: 'create-new' });
      });

      exportData.ice.forEach((ice) => {
        const match = existingIce.find((e) => e.name.toLowerCase() === ice.name.toLowerCase());
        autoMatchIce.push(match ? { exportId: ice.id, decision: 'use-existing', existingId: match.id } : { exportId: ice.id, decision: 'create-new' });
      });

      exportData.stepActions.forEach((action) => {
        const match = existingStepActions.find((e) => e.name.toLowerCase() === action.name.toLowerCase() && e.actionGroup === action.actionGroup);
        autoMatchStepActions.push(
          match ? { exportId: action.id, decision: 'use-existing', existingId: match.id } : { exportId: action.id, decision: 'create-new' },
        );
      });

      const cocktailConflicts = exportData.cocktailRecipes.map((expCocktail) => {
        const conflicts = existingCocktails.filter((existing) => existing.name.toLowerCase() === expCocktail.name.toLowerCase());
        return { exportId: expCocktail.id, exportName: expCocktail.name, conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })) };
      });

      return {
        status: 200,
        body: {
          existingMatches: {
            glasses: exportData.glasses.map((g) => ({
              exportId: g.id,
              exportName: g.name,
              matches: existingGlasses.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
            })),
            garnishes: exportData.garnishes.map((g) => ({
              exportId: g.id,
              exportName: g.name,
              matches: existingGarnishes.filter((e) => e.name.toLowerCase().includes(g.name.toLowerCase())),
            })),
            ingredients: exportData.ingredients.map((i) => ({
              exportId: i.id,
              exportName: i.name,
              matches: existingIngredients.filter((e) => e.name.toLowerCase().includes(i.name.toLowerCase())),
            })),
            units: exportData.units.map((u) => ({
              exportId: u.id,
              exportName: u.name,
              matches: existingUnits.filter((e) => e.name.toLowerCase() === u.name.toLowerCase()),
            })),
            ice: exportData.ice.map((i) => ({
              exportId: i.id,
              exportName: i.name,
              matches: existingIce.filter((e) => e.name.toLowerCase() === i.name.toLowerCase()),
            })),
            stepActions: exportData.stepActions.map((a) => ({
              exportId: a.id,
              exportName: a.name,
              matches: existingStepActions.filter((e) => e.name.toLowerCase() === a.name.toLowerCase() && e.actionGroup === a.actionGroup),
            })),
          },
          autoMappings: {
            glasses: autoMatchGlasses,
            garnishes: autoMatchGarnishes,
            ingredients: autoMatchIngredients,
            units: autoMatchUnits,
            ice: autoMatchIce,
            stepActions: autoMatchStepActions,
          },
          cocktailConflicts,
        },
      };
    }

    if (phase === 'execute') {
      if (!mappingDecisions) {
        return { status: 400, body: { message: 'Mapping-Entscheidungen fehlen' } };
      }

      const imported = { cocktails: 0, glasses: 0, garnishes: 0, ingredients: 0, units: 0, ice: 0, stepActions: 0 };
      const created = { glasses: 0, garnishes: 0, ingredients: 0, units: 0, ice: 0, stepActions: 0 };
      const errors: Array<{ step: string; entityType: string; entityName: string; error: string }> = [];

      try {
        await prisma.$transaction(async (transaction) => {
          const glassMapping = new Map<string, string>();
          const garnishMapping = new Map<string, string>();
          const ingredientMapping = new Map<string, string>();
          const unitMapping = new Map<string, string>();
          const iceMapping = new Map<string, string>();
          const stepActionMapping = new Map<string, string>();

          const existingTranslationsSetting = await transaction.workspaceSetting.findFirst({ where: { workspaceId, setting: 'translations' } });
          const translationsToUpdate: { [lang: string]: { [key: string]: string } } = JSON.parse(existingTranslationsSetting?.value ?? '{}');

          const addTranslation = (key: string, labelDe?: string, labelEn?: string) => {
            if (labelDe) {
              if (!translationsToUpdate.de) {
                translationsToUpdate.de = {};
              }
              translationsToUpdate.de[key] = labelDe;
            }
            if (labelEn) {
              if (!translationsToUpdate.en) {
                translationsToUpdate.en = {};
              }
              translationsToUpdate.en[key] = labelEn;
            }
          };

          const readEntityLabels = (data?: ImportEntityData) => ({
            labelDe: data?.labelDe ?? data?.lableDE,
            labelEn: data?.labelEn,
          });

          // Process units first
          for (const decision of mappingDecisions.units) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              unitMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.units.find((u) => u.id === decision.exportId);
              if (entityData) {
                const unitName = entityData.name;
                try {
                  const existing = await transaction.unit.findFirst({ where: { name: unitName, workspaceId } });
                  if (existing) {
                    errors.push({ step: 'units', entityType: 'Einheit', entityName: unitName, error: 'Existiert bereits (Unique-Constraint)' });
                    unitMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.unit.create({ data: { id: newId, name: unitName, workspaceId } });
                    {
                      const labels = readEntityLabels(decision.newEntityData);
                      if (labels.labelDe || labels.labelEn) {
                        addTranslation(unitName, labels.labelDe, labels.labelEn);
                      }
                    }
                    unitMapping.set(decision.exportId, newId);
                    created.units++;
                  }
                } catch (err: unknown) {
                  errors.push({ step: 'units', entityType: 'Einheit', entityName: unitName, error: err instanceof Error ? err.message : 'Unknown error' });
                }
              }
            }
          }

          // Process ice
          for (const decision of mappingDecisions.ice) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              iceMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.ice.find((i) => i.id === decision.exportId);
              if (entityData) {
                const iceName = entityData.name;
                try {
                  const existing = await transaction.ice.findFirst({ where: { name: iceName, workspaceId } });
                  if (existing) {
                    errors.push({ step: 'ice', entityType: 'Eis-Typ', entityName: iceName, error: 'Existiert bereits (Unique-Constraint)' });
                    iceMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.ice.create({ data: { id: newId, name: iceName, workspaceId } });
                    {
                      const labels = readEntityLabels(decision.newEntityData);
                      if (labels.labelDe || labels.labelEn) {
                        addTranslation(iceName, labels.labelDe, labels.labelEn);
                      }
                    }
                    iceMapping.set(decision.exportId, newId);
                    created.ice++;
                  }
                } catch (err: unknown) {
                  errors.push({ step: 'ice', entityType: 'Eis-Typ', entityName: iceName, error: err instanceof Error ? err.message : 'Unknown error' });
                }
              }
            }
          }

          // Process step actions
          for (const decision of mappingDecisions.stepActions) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              stepActionMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.stepActions.find((a) => a.id === decision.exportId);
              if (entityData) {
                const actionName = entityData.name;
                const actionGroup = entityData.actionGroup ?? '';
                try {
                  const existing = await transaction.workspaceCocktailRecipeStepAction.findFirst({
                    where: { name: actionName, actionGroup, workspaceId },
                  });
                  if (existing) {
                    errors.push({
                      step: 'stepActions',
                      entityType: 'Aktion',
                      entityName: `${actionName} (${actionGroup})`,
                      error: 'Existiert bereits (Unique-Constraint)',
                    });
                    stepActionMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.workspaceCocktailRecipeStepAction.create({ data: { id: newId, name: actionName, actionGroup, workspaceId } });
                    {
                      const labels = readEntityLabels(decision.newEntityData);
                      if (labels.labelDe || labels.labelEn) {
                        addTranslation(actionName, labels.labelDe, labels.labelEn);
                      }
                    }
                    stepActionMapping.set(decision.exportId, newId);
                    created.stepActions++;
                  }
                } catch (err: unknown) {
                  errors.push({
                    step: 'stepActions',
                    entityType: 'Aktion',
                    entityName: `${actionName} (${actionGroup})`,
                    error: err instanceof Error ? err.message : 'Unknown error',
                  });
                }
              }
            }
          }

          // Process glasses
          for (const decision of mappingDecisions.glasses) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              glassMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.glasses.find((g) => g.id === decision.exportId);
              if (entityData) {
                const glassName = entityData.name;
                try {
                  const existing = await transaction.glass.findFirst({ where: { name: glassName, workspaceId } });
                  if (existing) {
                    errors.push({ step: 'glasses', entityType: 'Glas', entityName: glassName, error: 'Existiert bereits (Unique-Constraint)' });
                    glassMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.glass.create({
                      data: {
                        id: newId,
                        name: glassName,
                        workspaceId,
                        deposit: entityData.deposit ?? 0,
                        volume: entityData.volume ?? null,
                        notes: entityData.notes ?? null,
                      },
                    });
                    glassMapping.set(decision.exportId, newId);
                    created.glasses++;

                    const glassImages = exportData.glassImages.filter((img) => img.glassId === decision.exportId);
                    for (const img of glassImages) {
                      await transaction.glassImage.upsert({
                        where: { glassId: newId },
                        update: { image: img.image },
                        create: { glassId: newId, image: img.image },
                      });
                    }
                  }
                } catch (err: unknown) {
                  errors.push({ step: 'glasses', entityType: 'Glas', entityName: glassName, error: err instanceof Error ? err.message : 'Unknown error' });
                }
              }
            }
          }

          // Process garnishes
          for (const decision of mappingDecisions.garnishes) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              garnishMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.garnishes.find((g) => g.id === decision.exportId);
              if (entityData) {
                const garnishName = entityData.name;
                try {
                  const existing = await transaction.garnish.findFirst({ where: { name: garnishName, workspaceId } });
                  if (existing) {
                    errors.push({ step: 'garnishes', entityType: 'Garnitur', entityName: garnishName, error: 'Existiert bereits (Unique-Constraint)' });
                    garnishMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.garnish.create({
                      data: {
                        id: newId,
                        name: garnishName,
                        workspaceId,
                        description: entityData.description ?? null,
                        notes: entityData.notes ?? null,
                        price: entityData.price ?? null,
                      },
                    });
                    garnishMapping.set(decision.exportId, newId);
                    created.garnishes++;

                    const garnishImages = exportData.garnishImages.filter((img) => img.garnishId === decision.exportId);
                    for (const img of garnishImages) {
                      await transaction.garnishImage.upsert({
                        where: { garnishId: newId },
                        update: { image: img.image },
                        create: { garnishId: newId, image: img.image },
                      });
                    }
                  }
                } catch (err: unknown) {
                  errors.push({
                    step: 'garnishes',
                    entityType: 'Garnitur',
                    entityName: garnishName,
                    error: err instanceof Error ? err.message : 'Unknown error',
                  });
                }
              }
            }
          }

          // Process ingredients
          for (const decision of mappingDecisions.ingredients) {
            if (decision.decision === 'use-existing' && decision.existingId) {
              ingredientMapping.set(decision.exportId, decision.existingId);
            } else if (decision.decision === 'create-new') {
              const entityData = decision.newEntityData || exportData.ingredients.find((i) => i.id === decision.exportId);
              if (entityData) {
                const ingredientName = entityData.name;
                try {
                  const existing = await transaction.ingredient.findFirst({ where: { name: ingredientName, workspaceId } });
                  if (existing) {
                    errors.push({ step: 'ingredients', entityType: 'Zutat', entityName: ingredientName, error: 'Existiert bereits (Unique-Constraint)' });
                    ingredientMapping.set(decision.exportId, existing.id);
                  } else {
                    const newId = randomUUID();
                    await transaction.ingredient.create({
                      data: {
                        id: newId,
                        name: ingredientName,
                        workspaceId,
                        shortName: entityData.shortName ?? null,
                        description: entityData.description ?? null,
                        notes: entityData.notes ?? null,
                        price: entityData.price ?? null,
                        link: entityData.link ?? null,
                        tags: entityData.tags ?? [],
                      },
                    });
                    ingredientMapping.set(decision.exportId, newId);
                    created.ingredients++;

                    const ingredientImages = exportData.ingredientImages.filter((img) => img.ingredientId === decision.exportId);
                    for (const img of ingredientImages) {
                      await transaction.ingredientImage.upsert({
                        where: { ingredientId: newId },
                        update: { image: img.image },
                        create: { ingredientId: newId, image: img.image },
                      });
                    }

                    const ingredientVolumes = exportData.ingredientVolumes.filter((vol) => vol.ingredientId === decision.exportId);
                    for (const vol of ingredientVolumes) {
                      const mappedUnitId = unitMapping.get(vol.unitId);
                      if (mappedUnitId) {
                        try {
                          const existingVolume = await transaction.ingredientVolume.findFirst({
                            where: { ingredientId: newId, unitId: mappedUnitId, workspaceId },
                          });
                          if (!existingVolume) {
                            await transaction.ingredientVolume.create({
                              data: { id: randomUUID(), ingredientId: newId, unitId: mappedUnitId, volume: vol.volume, workspaceId },
                            });
                          }
                        } catch (volErr: unknown) {
                          errors.push({
                            step: 'ingredientVolumes',
                            entityType: 'Zutaten-Volumen',
                            entityName: ingredientName,
                            error: volErr instanceof Error ? volErr.message : 'Failed to create volume',
                          });
                        }
                      }
                    }
                  }
                } catch (err: unknown) {
                  errors.push({
                    step: 'ingredients',
                    entityType: 'Zutat',
                    entityName: ingredientName,
                    error: err instanceof Error ? err.message : 'Unknown error',
                  });
                }
              }
            }
          }

          // Process cocktails
          for (const decision of mappingDecisions.cocktails) {
            if (decision.decision === 'skip') {
              continue;
            }

            const exportCocktail = exportData.cocktailRecipes.find((c) => c.id === decision.exportId);
            if (!exportCocktail) continue;

            try {
              let cocktailId: string;
              const cocktailName = decision.decision === 'rename' && decision.newName ? decision.newName : exportCocktail.name;

              if (decision.decision === 'overwrite' && decision.overwriteId) {
                cocktailId = decision.overwriteId;
                await transaction.cocktailRecipeIngredient.deleteMany({ where: { cocktailRecipeStep: { cocktailRecipeId: cocktailId } } });
                await transaction.cocktailRecipeGarnish.deleteMany({ where: { cocktailRecipeId: cocktailId } });
                await transaction.cocktailRecipeStep.deleteMany({ where: { cocktailRecipeId: cocktailId } });
                await transaction.cocktailRecipeImage.deleteMany({ where: { cocktailRecipeId: cocktailId } });
                await transaction.cocktailRecipe.delete({ where: { id: cocktailId } });
              }

              cocktailId = decision.decision === 'overwrite' ? decision.overwriteId! : randomUUID();

              const mappedGlassId = exportCocktail.glassId ? glassMapping.get(exportCocktail.glassId) : null;
              const mappedIceId = exportCocktail.iceId ? iceMapping.get(exportCocktail.iceId) : null;

              await transaction.cocktailRecipe.create({
                data: {
                  id: cocktailId,
                  name: cocktailName,
                  workspaceId,
                  glassId: mappedGlassId || null,
                  iceId: mappedIceId || null,
                  price: exportCocktail.price,
                  tags: exportCocktail.tags,
                  description: exportCocktail.description,
                  isArchived: exportCocktail.isArchived,
                  history: exportCocktail.history,
                  notes: exportCocktail.notes,
                },
              });
              imported.cocktails++;

              const cocktailImages = exportData.cocktailRecipeImages.filter((img) => img.cocktailRecipeId === decision.exportId);
              for (const img of cocktailImages) {
                await transaction.cocktailRecipeImage.upsert({
                  where: { cocktailRecipeId: cocktailId },
                  update: { image: img.image },
                  create: { cocktailRecipeId: cocktailId, image: img.image },
                });
              }

              const cocktailSteps = exportData.cocktailRecipeSteps.filter((step) => step.cocktailRecipeId === decision.exportId);
              const stepMapping = new Map<string, string>();

              for (const step of cocktailSteps) {
                const newStepId = randomUUID();
                stepMapping.set(step.id, newStepId);
                const mappedActionId = step.actionId ? stepActionMapping.get(step.actionId) : undefined;
                if (mappedActionId) {
                  await transaction.cocktailRecipeStep.create({
                    data: { id: newStepId, cocktailRecipeId: cocktailId, stepNumber: step.stepNumber, actionId: mappedActionId, optional: step.optional },
                  });
                }
              }

              const cocktailIngredients = exportData.cocktailRecipeIngredients.filter((ing) => {
                const stepId = ing.cocktailRecipeStepId;
                return cocktailSteps.some((s) => s.id === stepId);
              });

              for (const ing of cocktailIngredients) {
                const mappedStepId = stepMapping.get(ing.cocktailRecipeStepId);
                const mappedIngredientId = ing.ingredientId ? ingredientMapping.get(ing.ingredientId) : undefined;
                const mappedUnitId = ing.unitId ? unitMapping.get(ing.unitId) : undefined;
                if (mappedStepId) {
                  await transaction.cocktailRecipeIngredient.create({
                    data: {
                      id: randomUUID(),
                      cocktailRecipeStepId: mappedStepId,
                      ...(mappedIngredientId && { ingredientId: mappedIngredientId }),
                      ingredientNumber: ing.ingredientNumber,
                      optional: ing.optional,
                      amount: ing.amount,
                      ...(mappedUnitId && { unitId: mappedUnitId }),
                    },
                  });
                }
              }

              const cocktailGarnishes = exportData.cocktailRecipeGarnishes.filter((g) => g.cocktailRecipeId === decision.exportId);
              for (const g of cocktailGarnishes) {
                const mappedGarnishId = garnishMapping.get(g.garnishId);
                if (mappedGarnishId) {
                  await transaction.cocktailRecipeGarnish.create({
                    data: {
                      cocktailRecipeId: cocktailId,
                      garnishId: mappedGarnishId,
                      garnishNumber: g.garnishNumber,
                      optional: g.optional,
                      description: g.description,
                    },
                  });
                }
              }

              const fullImported = await transaction.cocktailRecipe.findUnique({
                where: { id: cocktailId },
                include: {
                  ice: true,
                  glass: true,
                  garnishes: { include: { garnish: true } },
                  steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
                  CocktailRecipeImage: true,
                },
              });

              await createCocktailRecipeAuditLog(transaction, workspace.id, user.id, cocktailId, 'CREATE', null, fullImported);
            } catch (err: unknown) {
              errors.push({
                step: 'cocktails',
                entityType: 'Cocktail',
                entityName: exportCocktail.name,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }

          if (Object.keys(translationsToUpdate).length > 0) {
            await transaction.workspaceSetting.upsert({
              where: { workspaceId_setting: { setting: 'translations', workspaceId } },
              create: { workspaceId, setting: 'translations', value: JSON.stringify(translationsToUpdate) },
              update: { value: JSON.stringify(translationsToUpdate) },
            });
          }
        });

        return { status: 200, body: { success: true, imported, created, ...(errors.length > 0 && { errors }) } };
      } catch (transactionError: unknown) {
        console.error('Transaction error:', transactionError);
        return {
          status: 500,
          body: {
            message: 'Failed to import cocktails',
            errors:
              errors.length > 0
                ? errors
                : [
                    {
                      step: 'transaction',
                      entityType: 'System',
                      entityName: '',
                      error: transactionError instanceof Error ? transactionError.message : 'Transaktionsfehler',
                    },
                  ],
          },
        };
      }
    }

    return { status: 400, body: { message: 'Invalid phase' } };
  } catch (error: unknown) {
    console.error('Import error:', error);
    return { status: 500, body: { message: error instanceof Error ? error.message : 'Failed to import cocktails' } };
  }
}
