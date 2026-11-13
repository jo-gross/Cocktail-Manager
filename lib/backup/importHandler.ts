import { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { MonitorFormat, Permission, Prisma, Role, type User, type Workspace } from '@generated/prisma/client';
import { ensureSignageContainer } from '@lib/signage/signageApiHelpers';
import { createLog } from '@lib/auditLog';
import { lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';
import { ApiError } from '@lib/http/ApiError';
import { MASTER_API_KEY_USER_ID } from '@lib/http/requestAuth';
import type { GuestMenuDocument } from '@lib/guest-menu/schema';
import {
  importedGuestMenuSafeState,
  normalizeBackupGuestMenuSlug,
  prepareBackupGuestMenuDocument,
  validateBackupGuestMenuTemplate,
  validateBackupWorkspaceSetting,
  type BackupImportReport,
} from '@lib/backup/backupSecurity';
import { BackupImportSchema, findBackupReferenceIssues, type BackupImportData } from '@lib/backup/backupSchema';

/** Long (large backups with images) but bounded; validation happens before the transaction. */
const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;
const MAX_REPORTED_VALIDATION_ISSUES = 100;

function createImportLogger(workspaceId: string) {
  const startedAt = Date.now();
  return {
    step: (message: string, details?: Record<string, unknown>) => {
      const elapsedMs = Date.now() - startedAt;
      if (details) {
        console.info(`[BackupImport][${workspaceId}] ${message} (+${elapsedMs}ms)`, details);
        return;
      }
      console.info(`[BackupImport][${workspaceId}] ${message} (+${elapsedMs}ms)`);
    },
  };
}

function convertUnit(unit: string): string {
  switch (unit) {
    case 'cl':
      return 'CL';
    case 'Dash':
      return 'DASH';
    case 'Stück':
      return 'PIECE';
    case 'Pip. cm':
      return 'DROPPER_CM';
    case 'Pip. Tropfen':
      return 'DROPPER_DROPS';
    case 'Pin. cm':
      return 'DROPPER_CM';
    case 'Pin. Tropfen':
      return 'DROPPER_DROPS';
    case 'Sprühen':
      return 'SPRAY';
    case 'g':
      return 'GRAMM';
    default:
      return 'Unknown';
  }
}

function convertIce(ice: string): string {
  switch (ice) {
    case 'Crushed':
      return 'ICE_CRUSHED';
    case 'Würfel':
      return 'ICE_CUBES';
    case 'Kugel':
      return 'ICE_BALL';
    case 'Ohne':
      return 'WITHOUT_ICE';
    default:
      return ice;
  }
}

/** Legacy step `tool` → action name. */
function convertTool(tool: string): string {
  return tool == 'PESTLE' ? 'MUDDLE' : tool == 'POUR' ? 'WITHOUT' : tool;
}

function parseBackupDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type BackupSlide = NonNullable<BackupImportData['signageSlides']>[number];
type BackupSignage = NonNullable<BackupImportData['signage']>[number];

function normalizeSignageSlide(
  slide: Pick<BackupSlide, 'format' | 'type' | 'content' | 'options' | 'enabled' | 'weekdays' | 'validFrom' | 'validTo' | 'dateExclusive'>,
  workspaceId: string,
  order: number,
) {
  return {
    id: randomUUID(),
    workspaceId,
    format: slide.format,
    type: slide.type ?? 'IMAGE',
    content: slide.content ?? '',
    // guestMenuId is linked after the guest menus were imported (new ids).
    options: slide.options == null ? Prisma.DbNull : (slide.options as Prisma.InputJsonValue),
    order,
    enabled: slide.enabled ?? true,
    weekdays: slide.weekdays ?? [],
    validFrom: parseBackupDate(slide.validFrom),
    validTo: parseBackupDate(slide.validTo),
    dateExclusive: slide.dateExclusive ?? false,
  };
}

function normalizeSignageRecord(signage: BackupSignage, workspaceId: string) {
  return {
    workspaceId,
    format: signage.format,
    backgroundColor: signage.backgroundColor ?? null,
    backgroundMode: signage.backgroundMode ?? 'COLOR',
    slideDurationSeconds: signage.slideDurationSeconds ?? 10,
    mirrorSourceFormat: signage.mirrorSourceFormat ?? null,
  };
}

/** Old id → new id for every record that is always created new (decided before the transaction). */
function newIds(rows: Array<{ id: string }> | undefined): Map<string, string> {
  return new Map((rows ?? []).map((row) => [row.id, randomUUID()]));
}

/** Request body → parsed JSON (the UI sends the backup as text). */
function readBody(req: NextApiRequest): unknown {
  if (typeof req.body !== 'string') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The backup file is not valid JSON');
  }
}

interface PreparedImport {
  data: BackupImportData;
  report: BackupImportReport;
  settings: Array<{ setting: Prisma.WorkspaceSettingCreateManyInput['setting']; value: string | null }>;
  templates: Array<{ newId: string; name: string; definition: Prisma.InputJsonValue }>;
  guestMenus: Array<{ menu: NonNullable<BackupImportData['guestMenus']>[number]; draft: GuestMenuDocument }>;
  ids: {
    garnish: Map<string, string>;
    ingredient: Map<string, string>;
    glass: Map<string, string>;
    cocktail: Map<string, string>;
    step: Map<string, string>;
    card: Map<string, string>;
    cardGroup: Map<string, string>;
    calculation: Map<string, string>;
    template: Map<string, string>;
  };
}

/**
 * Validates the whole backup without touching the database: structure (zod), references inside
 * the backup (400 on any broken one) and the per-item security rules for settings, custom
 * templates and guest menu documents (those invalid items are skipped and reported, as before).
 */
export function prepareBackupImport(body: unknown): PreparedImport {
  const parsed = BackupImportSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The backup file is invalid', parsed.error.issues.slice(0, MAX_REPORTED_VALIDATION_ISSUES));
  }
  const data = parsed.data;
  const referenceIssues = findBackupReferenceIssues(data);
  if (referenceIssues.length > 0) {
    throw new ApiError(400, 'INVALID_REFERENCE', 'The backup contains broken references', referenceIssues);
  }

  const report: BackupImportReport = { skipped: [] };
  const settings: PreparedImport['settings'] = [];
  for (const workspaceSetting of data.workspaceSettings) {
    const validated = validateBackupWorkspaceSetting({ setting: workspaceSetting.setting, value: workspaceSetting.value ?? null });
    if (validated.ok) settings.push(validated.value);
    else report.skipped.push({ type: 'workspaceSetting', name: String(workspaceSetting.setting), reason: validated.reason });
  }

  const ids: PreparedImport['ids'] = {
    garnish: newIds(data.garnish),
    ingredient: newIds(data.ingredient),
    glass: newIds(data.glass),
    cocktail: newIds(data.cocktailRecipe),
    step: newIds(data.cocktailRecipeStep),
    card: newIds(data.cocktailCard),
    cardGroup: newIds(data.cocktailCardGroup),
    calculation: newIds(data.calculation),
    template: new Map(),
  };

  const templates: PreparedImport['templates'] = [];
  for (const template of data.guestMenuTemplates ?? []) {
    const validated = validateBackupGuestMenuTemplate(template);
    if (!validated.ok) {
      // Menus referencing it fall back to the default template.
      report.skipped.push({ type: 'guestMenuTemplate', name: String(template.name), reason: validated.reason });
      continue;
    }
    const newId = randomUUID();
    ids.template.set(template.id, newId);
    templates.push({ newId, name: validated.value.name, definition: validated.value.definition as Prisma.InputJsonValue });
  }

  const idMaps = { cocktails: ids.cocktail, ingredients: ids.ingredient, cardGroups: ids.cardGroup, templates: ids.template };
  const guestMenus: PreparedImport['guestMenus'] = [];
  for (const menu of data.guestMenus ?? []) {
    const draft = prepareBackupGuestMenuDocument(menu.draft, idMaps);
    if (draft.ok) guestMenus.push({ menu, draft: draft.value });
    else report.skipped.push({ type: 'guestMenu', name: String(menu.name), reason: draft.reason });
  }

  return { data, report, settings, templates, guestMenus, ids };
}

/** Calculations need a real user (required FK); the master key acts as the workspace's owner. */
async function resolveCalculationUserId(tx: Tx, user: User, workspaceId: string): Promise<string> {
  if (user.id !== MASTER_API_KEY_USER_ID) return user.id;
  const owner = await tx.workspaceUser.findFirst({
    where: { workspaceId, role: { in: [Role.OWNER, Role.ADMIN] } },
    orderBy: { role: 'desc' },
    select: { userId: true },
  });
  if (!owner) throw new ApiError(403, 'REAL_USER_REQUIRED', 'Importing calculations with the master key requires a workspace owner or admin');
  return owner.userId;
}

/** Writes a prepared backup. Runs inside ONE transaction: any error rolls back everything. */
async function executeBackupImport(tx: Tx, prepared: PreparedImport, user: User, workspaceId: string) {
  const { data, ids } = prepared;
  const importLogger = createImportLogger(workspaceId);

  // Same scopes as the regular endpoints (slide order, tag categories, conversions, menu slugs).
  await lockWorkspaceScope(tx, workspaceId, 'guest-menus');
  await lockWorkspaceScope(tx, workspaceId, 'signage-slides');
  await lockWorkspaceScope(tx, workspaceId, 'tag-categories');
  await lockWorkspaceScope(tx, workspaceId, 'unit-conversions');

  for (const { setting, value } of prepared.settings) {
    await tx.workspaceSetting.upsert({
      where: { workspaceId_setting: { workspaceId, setting } },
      update: { value },
      create: { workspaceId, setting, value },
    });
  }

  const unitIdsByName = new Map<string, string>();
  const ensureUnit = async (name: string): Promise<string> => {
    const known = unitIdsByName.get(name);
    if (known) return known;
    const existing = await tx.unit.findFirst({ where: { name, workspaceId }, select: { id: true } });
    const id = existing?.id ?? (await tx.unit.create({ data: { id: randomUUID(), name, workspaceId } })).id;
    unitIdsByName.set(name, id);
    return id;
  };

  const unitMapping = new Map<string, string>();
  if (data.units.length > 0) importLogger.step('Importing units', { count: data.units.length });
  for (const unit of data.units) unitMapping.set(unit.id, await ensureUnit(unit.name));

  for (const conversion of data.unitConversions) {
    const fromUnitId = unitMapping.get(conversion.fromUnitId);
    const toUnitId = unitMapping.get(conversion.toUnitId);
    if (fromUnitId == undefined || toUnitId == undefined) continue;
    const existing = await tx.unitConversion.findFirst({ where: { workspaceId, fromUnitId, toUnitId }, select: { id: true } });
    if (existing == null) {
      await tx.unitConversion.create({
        data: { id: randomUUID(), fromUnitId, toUnitId, workspaceId, factor: conversion.factor, autoGenerated: conversion.autoGenerated },
      });
    }
  }

  const actionMapping = new Map<string, string>();
  for (const action of data.stepActions) {
    const existing = await tx.workspaceCocktailRecipeStepAction.findFirst({
      where: { name: action.name, workspaceId, actionGroup: action.actionGroup },
      select: { id: true },
    });
    if (existing) {
      actionMapping.set(action.id, existing.id);
    } else {
      const id = randomUUID();
      await tx.workspaceCocktailRecipeStepAction.create({
        data: { id, name: action.name, actionGroup: action.actionGroup, dilutionPercent: action.dilutionPercent, workspaceId },
      });
      actionMapping.set(action.id, id);
    }
  }
  const actions = await tx.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId }, select: { id: true, name: true } });

  if (data.garnish.length > 0) {
    importLogger.step('Importing garnishes', { count: data.garnish.length });
    await tx.garnish.createMany({
      data: data.garnish.map(({ image: _image, id, ...garnish }) => ({ ...garnish, id: ids.garnish.get(id)!, workspaceId })),
      skipDuplicates: true,
    });
  }
  const garnishImages = [
    ...data.garnish.flatMap((garnish) => (garnish.image ? [{ garnishId: ids.garnish.get(garnish.id)!, image: garnish.image }] : [])),
    ...data.garnishImages.flatMap((row) => (ids.garnish.has(row.garnishId) ? [{ garnishId: ids.garnish.get(row.garnishId)!, image: row.image }] : [])),
  ];
  await tx.garnishImage.createMany({ data: garnishImages, skipDuplicates: true });

  if (data.ingredient.length > 0) {
    importLogger.step('Importing ingredients', { count: data.ingredient.length });
    await tx.ingredient.createMany({
      data: data.ingredient.map(({ image: _image, volume: _volume, unit: _unit, id, ...ingredient }) => ({
        ...ingredient,
        id: ids.ingredient.get(id)!,
        workspaceId,
      })),
      skipDuplicates: true,
    });
  }
  // Older backups stored one volume + unit name on the ingredient.
  for (const ingredient of data.ingredient) {
    if (ingredient.volume == undefined || ingredient.unit == undefined) continue;
    await tx.ingredientVolume.create({
      data: {
        id: randomUUID(),
        ingredientId: ids.ingredient.get(ingredient.id)!,
        unitId: await ensureUnit(convertUnit(ingredient.unit)),
        volume: ingredient.volume,
        workspaceId,
      },
    });
  }
  for (const volume of data.ingredientVolumes) {
    const ingredientId = ids.ingredient.get(volume.ingredientId);
    const unitId = unitMapping.get(volume.unitId);
    if (ingredientId == undefined || unitId == undefined) continue;
    const existing = await tx.ingredientVolume.findFirst({ where: { ingredientId, unitId, workspaceId }, select: { id: true } });
    if (existing == null) await tx.ingredientVolume.create({ data: { id: randomUUID(), ingredientId, unitId, volume: volume.volume, workspaceId } });
  }
  const ingredientImages = [
    ...data.ingredient.flatMap((ingredient) => (ingredient.image ? [{ ingredientId: ids.ingredient.get(ingredient.id)!, image: ingredient.image }] : [])),
    ...data.ingredientImages.flatMap((row) =>
      ids.ingredient.has(row.ingredientId) ? [{ ingredientId: ids.ingredient.get(row.ingredientId)!, image: row.image }] : [],
    ),
  ];
  await tx.ingredientImage.createMany({ data: ingredientImages, skipDuplicates: true });

  if (data.glass.length > 0) {
    importLogger.step('Importing glasses', { count: data.glass.length });
    await tx.glass.createMany({
      data: data.glass.map(({ image: _image, id, ...glass }) => ({ ...glass, id: ids.glass.get(id)!, workspaceId })),
      skipDuplicates: true,
    });
  }
  const glassImages = [
    ...data.glass.flatMap((glass) => (glass.image ? [{ glassId: ids.glass.get(glass.id)!, image: glass.image }] : [])),
    ...data.glassImages.flatMap((row) => (ids.glass.has(row.glassId) ? [{ glassId: ids.glass.get(row.glassId)!, image: row.image }] : [])),
  ];
  await tx.glassImage.createMany({ data: glassImages, skipDuplicates: true });

  const iceIdsByName = new Map<string, string>();
  const ensureIce = async (name: string): Promise<string> => {
    const known = iceIdsByName.get(name);
    if (known) return known;
    const existing = await tx.ice.findFirst({ where: { workspaceId, name }, select: { id: true } });
    const id = existing?.id ?? (await tx.ice.create({ data: { id: randomUUID(), name, workspaceId } })).id;
    iceIdsByName.set(name, id);
    return id;
  };
  const iceMapping = new Map<string, string>();
  for (const ice of data.ice) iceMapping.set(ice.id, await ensureIce(ice.name));

  if (data.cocktailRecipe.length > 0) {
    importLogger.step('Importing cocktail recipes', { count: data.cocktailRecipe.length });
    const cocktails: Prisma.CocktailRecipeCreateManyInput[] = [];
    for (const { image: _image, glassWithIce, id, iceId, glassId, unavailableUntil, ...cocktail } of data.cocktailRecipe) {
      // Older backups stored the ice as a name on the cocktail.
      const mappedIceId = (iceId != null ? iceMapping.get(iceId) : undefined) ?? (glassWithIce ? await ensureIce(convertIce(glassWithIce)) : null);
      cocktails.push({
        ...cocktail,
        id: ids.cocktail.get(id)!,
        iceId: mappedIceId,
        glassId: glassId != null ? ids.glass.get(glassId)! : null,
        unavailableUntil: parseBackupDate(unavailableUntil),
        workspaceId,
      });
    }
    await tx.cocktailRecipe.createMany({ data: cocktails, skipDuplicates: true });
  }
  const cocktailImages = [
    ...data.cocktailRecipe.flatMap((cocktail) => (cocktail.image ? [{ cocktailRecipeId: ids.cocktail.get(cocktail.id)!, image: cocktail.image }] : [])),
    ...data.cocktailRecipeImage.flatMap((row) =>
      ids.cocktail.has(row.cocktailRecipeId) ? [{ cocktailRecipeId: ids.cocktail.get(row.cocktailRecipeId)!, image: row.image }] : [],
    ),
  ];
  await tx.cocktailRecipeImage.createMany({ data: cocktailImages, skipDuplicates: true });

  if (data.cocktailRecipeStep.length > 0) {
    importLogger.step('Importing cocktail recipe steps', { count: data.cocktailRecipeStep.length });
    await tx.cocktailRecipeStep.createMany({
      data: data.cocktailRecipeStep.map((step) => {
        let actionId = step.actionId != null ? actionMapping.get(step.actionId) : undefined;
        if (actionId == undefined && step.tool) actionId = actions.find((action) => action.name == convertTool(step.tool!))?.id;
        if (actionId == undefined) throw new ApiError(400, 'INVALID_REFERENCE', `Unknown action for a step of cocktail "${step.cocktailRecipeId}"`);
        return {
          id: ids.step.get(step.id)!,
          stepNumber: step.stepNumber,
          optional: step.optional,
          actionId,
          cocktailRecipeId: ids.cocktail.get(step.cocktailRecipeId)!,
        };
      }),
      skipDuplicates: true,
    });
  }

  if (data.cocktailRecipeGarnish.length > 0) {
    await tx.cocktailRecipeGarnish.createMany({
      data: data.cocktailRecipeGarnish.map((garnish) => ({
        cocktailRecipeId: ids.cocktail.get(garnish.cocktailRecipeId)!,
        garnishId: ids.garnish.get(garnish.garnishId)!,
        description: garnish.description,
        garnishNumber: garnish.garnishNumber,
        optional: garnish.optional ?? false,
        isAlternative: garnish.isAlternative ?? false,
      })),
      skipDuplicates: true,
    });
  }

  if (data.cocktailRecipeIngredient.length > 0) {
    importLogger.step('Importing cocktail recipe ingredients', { count: data.cocktailRecipeIngredient.length });
    const recipeIngredients: Prisma.CocktailRecipeIngredientCreateManyInput[] = [];
    for (const ingredient of data.cocktailRecipeIngredient) {
      // Unknown units become "no unit" (as before); older backups stored a unit name.
      let unitId = ingredient.unitId != null ? (unitMapping.get(ingredient.unitId) ?? null) : null;
      if (ingredient.unit != undefined) unitId = await ensureUnit(convertUnit(ingredient.unit));
      recipeIngredients.push({
        id: randomUUID(),
        ingredientNumber: ingredient.ingredientNumber,
        optional: ingredient.optional,
        amount: ingredient.amount,
        unitId,
        ingredientId: ingredient.ingredientId != null ? ids.ingredient.get(ingredient.ingredientId)! : null,
        cocktailRecipeStepId: ids.step.get(ingredient.cocktailRecipeStepId)!,
      });
    }
    await tx.cocktailRecipeIngredient.createMany({ data: recipeIngredients, skipDuplicates: true });
  }

  if (data.cocktailCard.length > 0) {
    await tx.cocktailCard.createMany({
      data: data.cocktailCard.map((card) => ({
        id: ids.card.get(card.id)!,
        name: card.name,
        date: parseBackupDate(card.date),
        archived: card.archived,
        workspaceId,
      })),
      skipDuplicates: true,
    });
  }
  if (data.cocktailCardGroup.length > 0) {
    await tx.cocktailCardGroup.createMany({
      data: data.cocktailCardGroup.map((group) => ({
        id: ids.cardGroup.get(group.id)!,
        groupNumber: group.groupNumber,
        name: group.name,
        cocktailCardId: ids.card.get(group.cocktailCardId)!,
        groupPrice: group.groupPrice,
      })),
      skipDuplicates: true,
    });
  }
  if (data.cocktailCardGroupItem.length > 0) {
    await tx.cocktailCardGroupItem.createMany({
      data: data.cocktailCardGroupItem.map((item) => ({
        itemNumber: item.itemNumber,
        cocktailCardGroupId: ids.cardGroup.get(item.cocktailCardGroupId)!,
        cocktailId: ids.cocktail.get(item.cocktailId)!,
        specialPrice: item.specialPrice,
      })),
      skipDuplicates: true,
    });
  }

  const calculationGroupMapping = new Map<string, string>();
  for (const group of data.calculationGroups) {
    const existing = await tx.cocktailCalculationGroup.findFirst({ where: { workspaceId, name: group.name }, select: { id: true } });
    if (existing) {
      calculationGroupMapping.set(group.id, existing.id);
      await tx.cocktailCalculationGroup.updateMany({ where: { id: existing.id, workspaceId }, data: { isDefaultExpanded: group.isDefaultExpanded } });
    } else {
      const id = randomUUID();
      calculationGroupMapping.set(group.id, id);
      await tx.cocktailCalculationGroup.create({ data: { id, name: group.name, workspaceId, isDefaultExpanded: group.isDefaultExpanded } });
    }
  }

  if (data.calculation.length > 0) {
    importLogger.step('Importing calculations', { count: data.calculation.length });
    const updatedByUserId = await resolveCalculationUserId(tx, user, workspaceId);
    await tx.cocktailCalculation.createMany({
      data: data.calculation.map((calculation) => ({
        id: ids.calculation.get(calculation.id)!,
        name: calculation.name,
        showSalesStuff: calculation.showSalesStuff,
        groupId: calculation.groupId ? (calculationGroupMapping.get(calculation.groupId) ?? null) : null,
        workspaceId,
        updatedByUserId,
      })),
      skipDuplicates: true,
    });
  }
  if (data.calculationItems.length > 0) {
    await tx.cocktailCalculationItems.createMany({
      data: data.calculationItems.map((item) => ({
        plannedAmount: item.plannedAmount,
        customPrice: item.customPrice,
        cocktailId: ids.cocktail.get(item.cocktailId)!,
        calculationId: ids.calculation.get(item.calculationId)!,
      })),
      skipDuplicates: true,
    });
  }

  // Imported slides are appended after the workspace's existing slides of the same format.
  const nextSlideOrder = new Map<MonitorFormat, number>();
  const takeSlideOrder = async (format: MonitorFormat): Promise<number> => {
    let next = nextSlideOrder.get(format);
    if (next === undefined) {
      const last = await tx.signageSlide.findFirst({ where: { workspaceId, format }, orderBy: { order: 'desc' }, select: { order: true } });
      next = last ? last.order + 1 : 0;
    }
    nextSlideOrder.set(format, next + 1);
    return next;
  };

  for (const signageRecord of data.signage ?? []) {
    const normalizedSignage = normalizeSignageRecord(signageRecord, workspaceId);
    await tx.signage.upsert({
      where: { workspaceId_format: { workspaceId, format: signageRecord.format } },
      create: normalizedSignage,
      update: {
        backgroundColor: normalizedSignage.backgroundColor,
        backgroundMode: normalizedSignage.backgroundMode,
        slideDurationSeconds: normalizedSignage.slideDurationSeconds,
        mirrorSourceFormat: normalizedSignage.mirrorSourceFormat,
      },
    });

    const legacyContent = signageRecord.content;
    const hasSlidesForFormat = data.signageSlides?.some((slide) => slide.format === signageRecord.format);
    if (legacyContent && !hasSlidesForFormat) {
      await tx.signageSlide.create({
        data: normalizeSignageSlide({ format: signageRecord.format, content: legacyContent }, workspaceId, await takeSlideOrder(signageRecord.format)),
      });
    }
  }

  /** New slide id → guest menu id from the backup (remapped after the guest menu import). */
  const signageSlideMenuLinks: { slideId: string; backupMenuId: string }[] = [];
  const slides = [...(data.signageSlides ?? [])].sort((a, b) => a.order - b.order);
  if (slides.length > 0) importLogger.step('Importing signage slides', { count: slides.length });
  for (const slide of slides) {
    await ensureSignageContainer(tx, workspaceId, slide.format);
    const created = await tx.signageSlide.create({ data: normalizeSignageSlide(slide, workspaceId, await takeSlideOrder(slide.format)) });
    if (slide.type === 'GUEST_MENU' && slide.guestMenuId) {
      signageSlideMenuLinks.push({ slideId: created.id, backupMenuId: slide.guestMenuId });
    }
  }

  const tagCategoryMapping = new Map<string, string>();
  if ((data.tagCategories?.length ?? 0) > 0) {
    const existingCategories = await tx.tagCategory.findMany({ where: { workspaceId } });
    const nameKey = (name: unknown) =>
      name && typeof name === 'object'
        ? Object.values(name as Record<string, unknown>)
            .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
            .map((value) => value.trim().toLocaleLowerCase())
        : [];
    for (const category of data.tagCategories!) {
      const keys = nameKey(category.name);
      const existing = existingCategories.find((candidate) => nameKey(candidate.name).some((key) => keys.includes(key)));
      if (existing) {
        tagCategoryMapping.set(category.id, existing.id);
      } else {
        const created = await tx.tagCategory.create({
          data: {
            workspaceId,
            name: (category.name ?? {}) as Prisma.InputJsonValue,
            order: category.order ?? 0,
            showAsGuestFilter: category.showAsGuestFilter ?? true,
          },
        });
        existingCategories.push(created);
        tagCategoryMapping.set(category.id, created.id);
      }
    }
  }

  for (const definition of data.tagDefinitions ?? []) {
    const values = {
      label: definition.label == null ? Prisma.DbNull : (definition.label as Prisma.InputJsonValue),
      categoryId: definition.categoryId ? (tagCategoryMapping.get(definition.categoryId) ?? null) : null,
      color: definition.color ?? null,
      isPublic: definition.isPublic ?? true,
    };
    await tx.tagDefinition.upsert({
      where: { workspaceId_tag: { workspaceId, tag: definition.tag } },
      create: { workspaceId, tag: definition.tag, ...values },
      update: values,
    });
  }

  const mapTranslations = <T>(rows: T[] | undefined, getId: (row: T) => string, mapping: Map<string, string>) =>
    (rows ?? []).flatMap((row) => {
      const newId = mapping.get(getId(row));
      return newId ? [{ row, newId }] : [];
    });
  const cocktailTranslations = mapTranslations(data.cocktailRecipeTranslations, (row) => row.cocktailId, ids.cocktail);
  const ingredientTranslations = mapTranslations(data.ingredientTranslations, (row) => row.ingredientId, ids.ingredient);
  const garnishTranslations = mapTranslations(data.garnishTranslations, (row) => row.garnishId, ids.garnish);
  const glassTranslations = mapTranslations(data.glassTranslations, (row) => row.glassId, ids.glass);
  await tx.cocktailRecipeTranslation.createMany({
    data: cocktailTranslations.map(({ row, newId }) => ({
      cocktailId: newId,
      locale: row.locale,
      name: row.name,
      description: row.description,
      history: row.history,
    })),
    skipDuplicates: true,
  });
  await tx.ingredientTranslation.createMany({
    data: ingredientTranslations.map(({ row, newId }) => ({
      ingredientId: newId,
      locale: row.locale,
      name: row.name,
      guestName: row.guestName,
      description: row.description,
    })),
    skipDuplicates: true,
  });
  await tx.garnishTranslation.createMany({
    data: garnishTranslations.map(({ row, newId }) => ({ garnishId: newId, locale: row.locale, name: row.name, description: row.description })),
    skipDuplicates: true,
  });
  await tx.glassTranslation.createMany({
    data: glassTranslations.map(({ row, newId }) => ({ glassId: newId, locale: row.locale, name: row.name })),
    skipDuplicates: true,
  });

  for (const template of prepared.templates) {
    await tx.guestMenuTemplate.create({ data: { id: template.newId, workspaceId, name: template.name, definition: template.definition } });
  }

  const guestMenuMapping = new Map<string, string>();
  if (prepared.guestMenus.length > 0) {
    importLogger.step('Importing guest menus', { count: prepared.guestMenus.length });
    const takenSlugs = new Set((await tx.guestMenu.findMany({ where: { workspaceId }, select: { slug: true } })).map((menu) => menu.slug));
    for (const { menu, draft } of prepared.guestMenus) {
      const baseSlug = normalizeBackupGuestMenuSlug(menu.slug);
      let slug = baseSlug;
      for (let i = 2; takenSlugs.has(slug); i++) slug = `${baseSlug}-${i}`;
      takenSlugs.add(slug);
      const sourceCardId = menu.sourceCardId ? (ids.card.get(menu.sourceCardId) ?? null) : null;
      const createdMenu = await tx.guestMenu.create({
        data: {
          workspaceId,
          name: menu.name,
          slug,
          // Never live after an import: disabled, unpublished, not default, no access code, new preview token.
          ...importedGuestMenuSafeState(),
          priority: menu.priority ?? 0,
          validFrom: parseBackupDate(menu.validFrom),
          validTo: parseBackupDate(menu.validTo),
          weekdays: menu.weekdays ?? [],
          timeFrom: menu.timeFrom ?? null,
          timeTo: menu.timeTo ?? null,
          inactiveBehavior: menu.inactiveBehavior ?? 'NOTICE_WITH_LINK',
          sourceMode: menu.sourceMode === 'FIXED_CARD' && !sourceCardId ? 'NONE' : (menu.sourceMode ?? 'NONE'),
          sourceCardId,
          locales: menu.locales ?? [],
          draft: draft as unknown as Prisma.InputJsonValue,
        },
      });
      guestMenuMapping.set(menu.id, createdMenu.id);
    }
  }

  // Guest menu signage slides: point to the re-created menus (unknown menus → active menu).
  for (const link of signageSlideMenuLinks) {
    const guestMenuId = guestMenuMapping.get(link.backupMenuId);
    if (guestMenuId) await tx.signageSlide.update({ where: { id: link.slideId }, data: { guestMenuId } });
  }

  const counts = {
    cocktails: data.cocktailRecipe.length,
    ingredients: data.ingredient.length,
    garnishes: data.garnish.length,
    glasses: data.glass.length,
    cards: data.cocktailCard.length,
    calculations: data.calculation.length,
    signageSlides: slides.length,
    guestMenus: guestMenuMapping.size,
    skipped: prepared.report.skipped.length,
  };
  await createLog(tx, workspaceId, user.id, 'WorkspaceBackup', workspaceId, 'CREATE', null, { action: 'IMPORT', ...counts });
  importLogger.step('Import transaction finished', counts);
}

async function importBackup(req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) {
  const workspaceId = workspace.id;
  // Parse and validate everything before opening the transaction.
  const prepared = prepareBackupImport(readBody(req));

  await runTx((tx) => executeBackupImport(tx, prepared, user, workspaceId), {
    timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
    maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
  });

  return res.status(200).json({ msg: 'Success', report: prepared.report });
}

/**
 * Imports a backup into the workspace (admins; API keys need BACKUPS_IMPORT). All-or-nothing:
 * the payload is validated first (structure, references → 400, nothing written), then written in
 * one transaction. Settings, custom templates and guest menu documents that fail the security
 * rules are skipped and listed in `report.skipped`; imported guest menus are disabled and unpublished.
 */
export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.ADMIN], Permission.BACKUPS_IMPORT, importBackup),
});
