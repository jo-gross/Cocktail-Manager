import { NextApiRequest, NextApiResponse } from 'next';
import { BackupStructure, SignageBackupRecord, SignageSlideBackupRecord } from './backupStructure';
import prisma from '../../prisma/prisma';
import { randomUUID } from 'crypto';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { MonitorFormat, Permission, Prisma, Role } from '@generated/prisma/client';
import { ensureSignageContainer } from '@lib/signage/signageApiHelpers';
import {
  importedGuestMenuSafeState,
  normalizeBackupGuestMenuSlug,
  prepareBackupGuestMenuDocument,
  validateBackupGuestMenuTemplate,
  validateBackupWorkspaceSetting,
  type BackupImportReport,
} from '@lib/backup/backupSecurity';

const IMPORT_TRANSACTION_TIMEOUT_MS = 30 * 60 * 1000;

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

function parseBackupDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSignageSlide(slide: SignageSlideBackupRecord, workspaceId: string) {
  return {
    id: randomUUID(),
    workspaceId,
    format: slide.format,
    type: slide.type ?? 'IMAGE',
    content: slide.content ?? '',
    // guestMenuId is linked after the guest menus were imported (new ids).
    options: slide.options == null ? Prisma.DbNull : (slide.options as Prisma.InputJsonValue),
    order: slide.order,
    enabled: slide.enabled ?? true,
    weekdays: slide.weekdays ?? [],
    validFrom: parseBackupDate(slide.validFrom),
    validTo: parseBackupDate(slide.validTo),
    dateExclusive: slide.dateExclusive ?? false,
  };
}

function normalizeSignageRecord(signage: SignageBackupRecord, workspaceId: string) {
  return {
    workspaceId,
    format: signage.format,
    backgroundColor: signage.backgroundColor ?? null,
    backgroundMode: signage.backgroundMode ?? 'COLOR',
    slideDurationSeconds: signage.slideDurationSeconds ?? 10,
    mirrorSourceFormat: signage.mirrorSourceFormat ?? null,
  };
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

/**
 * Imports a backup into the workspace (admins; API keys need BACKUPS_IMPORT). The payload is
 * untrusted: settings, custom templates and guest menu documents are validated (invalid ones are
 * skipped and listed in `report.skipped`), imported guest menus are disabled and unpublished.
 */
export default withWorkspacePermission([Role.ADMIN], Permission.BACKUPS_IMPORT, async (req: NextApiRequest, res: NextApiResponse, user, _workspace) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });

  if (req.method === 'POST') {
    try {
      const importLogger = createImportLogger(workspaceId);
      importLogger.step('Import started');
      const report: BackupImportReport = { skipped: [] };

      await prisma.$transaction(
        async (transaction) => {
          const data: BackupStructure = JSON.parse(await req.body);

          importLogger.step('Backup payload parsed', {
            workspaceSettings: data.workspaceSettings?.length ?? 0,
            units: data.units?.length ?? 0,
            ingredients: data.ingredient?.length ?? 0,
            cocktails: data.cocktailRecipe?.length ?? 0,
            calculations: data.calculation?.length ?? 0,
            signage: data.signage?.length ?? 0,
            signageSlides: data.signageSlides?.length ?? 0,
          });

          if (data.workspaceSettings?.length > 0) {
            importLogger.step('Importing workspace settings', { count: data.workspaceSettings.length });
            for (const workspaceSetting of data.workspaceSettings) {
              const validated = validateBackupWorkspaceSetting(workspaceSetting);
              if (!validated.ok) {
                report.skipped.push({ type: 'workspaceSetting', name: String(workspaceSetting.setting), reason: validated.reason });
                continue;
              }
              const { setting, value } = validated.value;
              await transaction.workspaceSetting.upsert({
                where: { workspaceId_setting: { workspaceId, setting } },
                update: { value },
                create: { workspaceId, setting, value },
              });
            }
          }

          const unitMapping: { id: string; newId: string }[] = [];
          if (data.units?.length > 0) {
            importLogger.step('Importing units', { count: data.units.length });

            for (const g of data.units) {
              const originalUnitId = g.id;
              const existingUnit = await transaction.unit.findFirst({
                where: { name: g.name, workspaceId: workspaceId },
              });
              if (existingUnit == null) {
                g.id = randomUUID();
                g.workspaceId = workspaceId;
                await transaction.unit.create({ data: g });
                unitMapping.push({ id: originalUnitId, newId: g.id });
              } else {
                unitMapping.push({ id: originalUnitId, newId: existingUnit.id });
              }
            }
          }

          if (data.unitConversions?.length > 0) {
            importLogger.step('Importing unit conversions', { count: data.unitConversions.length });

            for (const g of data.unitConversions) {
              const newFromId = unitMapping.find((gm) => gm.id === g.fromUnitId)?.newId;
              const newToId = unitMapping.find((gm) => gm.id === g.toUnitId)?.newId;
              if (newFromId != undefined && newToId != undefined) {
                const existingUnitConversion = await transaction.unitConversion.findFirst({
                  where: {
                    workspaceId: workspaceId,
                    fromUnitId: newFromId,
                    toUnitId: newToId,
                  },
                });
                if (existingUnitConversion == null) {
                  g.id = randomUUID();
                  g.fromUnitId = newFromId;
                  g.toUnitId = newToId;
                  g.workspaceId = workspaceId;
                  await transaction.unitConversion.create({ data: g });
                }
              }
            }
          }

          const actionMapping: { id: string; newId: string }[] = [];
          if (data.stepActions?.length > 0) {
            importLogger.step('Importing step actions', { count: data.stepActions.length });
            for (const g of data.stepActions) {
              const existingAction = await transaction.workspaceCocktailRecipeStepAction.findFirst({
                where: { name: g.name, workspaceId: workspaceId, actionGroup: g.actionGroup },
              });
              if (existingAction == null) {
                const newId = randomUUID();
                actionMapping.push({ id: g.id, newId: newId });
                g.id = newId;
                g.workspaceId = workspaceId;

                await transaction.workspaceCocktailRecipeStepAction.create({ data: g });
              } else {
                actionMapping.push({ id: g.id, newId: existingAction.id });
              }
            }
          }

          const actions = await transaction.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId } });

          const garnishMapping: { id: string; newId: string }[] = [];
          const garnishImageMapping: { garnishId: string; image: string }[] = [];
          if (data.garnish?.length > 0) {
            importLogger.step('Importing garnishes', { count: data.garnish.length });
            data.garnish?.forEach((g) => {
              const garnishMappingItem = { id: g.id, newId: randomUUID() };
              // @ts-expect-error causing older backup version support
              if (g.image != undefined) {
                // @ts-expect-error causing older backup version support
                garnishImageMapping.push({ garnishId: garnishMappingItem.newId, image: g.image });
              }
              g.id = garnishMappingItem.newId;
              g.workspaceId = workspaceId;
              // @ts-expect-error causing older backup version support
              g.image = undefined;
              garnishMapping.push(garnishMappingItem);
            });
            await transaction.garnish.createMany({ data: data.garnish, skipDuplicates: true });
          }
          if (data.garnishImages?.length > 0) {
            for (const image of data.garnishImages) {
              const garnish = garnishMapping.find((gm) => gm.id === image.garnishId);
              if (garnish) {
                garnishImageMapping.push({ garnishId: garnish.newId, image: image.image });
              }
            }
          }
          await transaction.garnishImage.createMany({ data: garnishImageMapping, skipDuplicates: true });

          const ingredientMapping: { id: string; newId: string }[] = [];
          const ingredientImageMapping: { ingredientId: string; image: string }[] = [];

          const oldVolumes: { ingredientId: string; unitId: string; volume: number }[] = [];

          if (data.ingredient?.length > 0) {
            importLogger.step('Importing ingredients', { count: data.ingredient.length });

            for (const g of data.ingredient) {
              const ingredientMappingItem = { id: g.id, newId: randomUUID() };
              // @ts-expect-error causing older backup version support
              if (g.image != undefined) {
                // @ts-expect-error causing older backup version support
                ingredientImageMapping.push({ ingredientId: ingredientMappingItem.newId, image: g.image });
              }
              g.id = ingredientMappingItem.newId;
              g.workspaceId = workspaceId;
              // @ts-expect-error causing older backup version support
              g.image = undefined;
              // Enable older backup imports
              // @ts-expect-error causing older backup version support
              if (g.volume != undefined && g.unit != undefined) {
                // @ts-expect-error causing older backup version support
                const unitIdentifier = convertUnit(g.unit);
                const unit = await transaction.unit.findFirst({ where: { name: unitIdentifier, workspaceId: workspaceId } });
                let unitId = unit?.id;
                if (unitId == undefined) {
                  unitId = randomUUID();
                  await transaction.unit.create({ data: { id: unitId, name: unitIdentifier, workspaceId: workspaceId } });
                }
                oldVolumes.push({
                  ingredientId: g.id,
                  // @ts-expect-error causing older backup version support
                  volume: g.volume,
                  unitId: unitId,
                });
              }
              // @ts-expect-error causing older backup version support
              g.volume = undefined;
              // @ts-expect-error causing older backup version support
              g.unit = undefined;
              ingredientMapping.push(ingredientMappingItem);
            }
            await transaction.ingredient.createMany({ data: data.ingredient, skipDuplicates: true });
          }
          importLogger.step('Mapped legacy ingredient volumes', { count: oldVolumes.length });
          if (data.ingredientImages?.length > 0) {
            for (const image of data.ingredientImages) {
              const ingredient = ingredientMapping.find((gm) => gm.id === image.ingredientId);
              if (ingredient) {
                ingredientImageMapping.push({ ingredientId: ingredient.newId, image: image.image });
              }
            }
          }
          for (const volume of oldVolumes) {
            if (volume.unitId != undefined) {
              await transaction.ingredientVolume.create({
                data: {
                  id: randomUUID(),
                  ingredientId: volume.ingredientId,
                  unitId: volume.unitId,
                  volume: volume.volume,
                  workspaceId: workspaceId,
                },
              });
            }
          }
          if (data.ingredientVolumes?.length > 0) {
            for (const volume of data.ingredientVolumes) {
              const newIngredientId = ingredientMapping.find((gm) => gm.id === volume.ingredientId)?.newId;
              const newUnitId = unitMapping.find((gm) => gm.id === volume.unitId)?.newId;

              if (newIngredientId != undefined && newUnitId != undefined) {
                const existingVolume = await transaction.ingredientVolume.findFirst({
                  where: {
                    ingredientId: newIngredientId,
                    unitId: newUnitId,
                    workspaceId: workspaceId,
                  },
                });
                if (existingVolume == null) {
                  volume.id = randomUUID();
                  volume.ingredientId = newIngredientId;
                  volume.unitId = newUnitId;
                  volume.workspaceId = workspaceId;
                  await transaction.ingredientVolume.create({ data: volume });
                }
              }
            }
          }
          await transaction.ingredientImage.createMany({ data: ingredientImageMapping, skipDuplicates: true });

          const glassMapping: { id: string; newId: string }[] = [];
          const glassImageMapping: { glassId: string; image: string }[] = [];
          if (data.glass?.length > 0) {
            importLogger.step('Importing glasses', { count: data.glass.length });
            data.glass?.forEach((g) => {
              const glassMappingItem = { id: g.id, newId: randomUUID() };
              // @ts-expect-error causing older backup version support
              if (g.image != undefined) {
                // @ts-expect-error causing older backup version support
                glassImageMapping.push({ glassId: glassMappingItem.newId, image: g.image });
              }
              g.id = glassMappingItem.newId;
              g.workspaceId = workspaceId;
              // @ts-expect-error causing older backup version support
              g.image = undefined;
              glassMapping.push(glassMappingItem);
            });
            await transaction.glass.createMany({ data: data.glass, skipDuplicates: true });
          }
          if (data.glassImages?.length > 0) {
            for (const image of data.glassImages) {
              const glass = glassMapping.find((gm) => gm.id === image.glassId);
              if (glass) {
                glassImageMapping.push({ glassId: glass.newId, image: image.image });
              }
            }
          }
          await transaction.glassImage.createMany({ data: glassImageMapping, skipDuplicates: true });

          const iceMapping: { id: string; newId: string }[] = [];
          if (data.ice?.length > 0) {
            importLogger.step('Importing ice', { count: data.ice.length });
            const iceToCreate: typeof data.ice = [];
            for (const ice of data.ice) {
              const existing = await transaction.ice.findFirst({ where: { workspaceId: workspaceId, name: ice.name } });
              if (existing) {
                iceMapping.push({ id: ice.id, newId: existing.id });
              } else {
                const originalIceId = ice.id;
                ice.id = randomUUID();
                ice.workspaceId = workspaceId;
                iceMapping.push({ id: originalIceId, newId: ice.id });
                iceToCreate.push(ice);
              }
            }
            if (iceToCreate.length > 0) {
              await transaction.ice.createMany({ data: iceToCreate, skipDuplicates: true });
            }
          }

          // ensure that all oldIce is imported
          let oldIceMapping: { name: string; newId: string }[] = [];
          if (data.cocktailRecipe?.length > 0) {
            for (const cocktail of data.cocktailRecipe) {
              // @ts-expect-error causing older backup version support
              if (cocktail.glassWithIce != undefined) {
                // @ts-expect-error causing older backup version support
                const iceIdentifier = convertIce(cocktail.glassWithIce);
                if (oldIceMapping.find((ice) => ice.name == iceIdentifier) == undefined) {
                  const ice = await transaction.ice.findFirst({ where: { name: iceIdentifier, workspaceId: workspaceId } });
                  if (ice == undefined) {
                    const result = await transaction.ice.create({ data: { id: randomUUID(), name: iceIdentifier, workspaceId: workspaceId } });
                    oldIceMapping = [...oldIceMapping, { name: iceIdentifier, newId: result.id }];
                  } else {
                    oldIceMapping = [...oldIceMapping, { name: iceIdentifier, newId: ice.id }];
                  }
                }
              }
            }
          }
          importLogger.step('Mapped legacy ice references', { count: oldIceMapping.length });

          const cocktailRecipeMapping: { id: string; newId: string }[] = [];
          const cocktailRecipeImageMapping: { cocktailRecipeId: string; image: string }[] = [];
          if (data.cocktailRecipe?.length > 0) {
            importLogger.step('Importing cocktail recipes', { count: data.cocktailRecipe.length });
            data.cocktailRecipe?.forEach((g) => {
              const cocktailRecipeMappingItem = { id: g.id, newId: randomUUID() };
              // @ts-expect-error causing older backup version support
              if (g.image != undefined) {
                // @ts-expect-error causing older backup version support
                cocktailRecipeImageMapping.push({ cocktailRecipeId: cocktailRecipeMappingItem.newId, image: g.image });
              }
              g.id = cocktailRecipeMappingItem.newId;
              // @ts-expect-error causing older backup version support
              g.iceId = iceMapping.find((ice) => ice.id === g.iceId)?.newId;
              if (g.iceId == undefined) {
                // @ts-expect-error causing older backup version support
                g.iceId = oldIceMapping.find((ice) => ice.name == convertIce(g.glassWithIce))?.newId;

                if (g.iceId == undefined) {
                  console.error('IceId is undefined', g);
                  throw new Error('IceId is undefined');
                }
              }
              g.glassId = glassMapping.find((gm) => gm.id === g.glassId)!.newId;
              g.workspaceId = workspaceId;
              // @ts-expect-error causing older backup version support
              g.image = undefined;
              // @ts-expect-error causing older backup version support
              g.glassWithIce = undefined;
              cocktailRecipeMapping.push(cocktailRecipeMappingItem);
            });

            await Promise.all(
              data.cocktailRecipe.map(async (g) => {
                if ((await transaction.ice.findFirst({ where: { id: g.iceId! } })) == null) {
                  console.error('Ice not found', g.iceId);
                  const ice = (await transaction.ice.findMany({ where: { workspaceId: workspaceId } })).filter((i) => i.id == g.iceId);
                  importLogger.step('Missing ice reference detected while importing cocktail', {
                    cocktailName: g.name,
                    iceId: g.iceId,
                    availableIceCount: ice.length,
                  });
                  console.error('Cocktail', g.name);
                }
              }),
            );

            await transaction.cocktailRecipe.createMany({ data: data.cocktailRecipe, skipDuplicates: true });
          }
          if (data.cocktailRecipeImage?.length > 0) {
            for (const image of data.cocktailRecipeImage) {
              const cocktail = cocktailRecipeMapping.find((gm) => gm.id === image.cocktailRecipeId);
              if (cocktail) {
                cocktailRecipeImageMapping.push({ cocktailRecipeId: cocktail.newId, image: image.image });
              }
            }
          }
          await transaction.cocktailRecipeImage.createMany({ data: cocktailRecipeImageMapping, skipDuplicates: true });

          const cocktailRecipeStepMapping: { id: string; newId: string }[] = [];
          if (data.cocktailRecipeStep?.length > 0) {
            importLogger.step('Importing cocktail recipe steps', { count: data.cocktailRecipeStep.length });
            data.cocktailRecipeStep?.forEach((g) => {
              const cocktailRecipeStepMappingItem = { id: g.id, newId: randomUUID() };
              g.id = cocktailRecipeStepMappingItem.newId;
              g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)!.newId;
              cocktailRecipeStepMapping.push(cocktailRecipeStepMappingItem);
            });
            const cocktailRecipeSteps = data.cocktailRecipeStep?.map((step) => {
              if (step.actionId == undefined) {
                return {
                  id: step.id,
                  stepNumber: step.stepNumber,
                  cocktailRecipeId: step.cocktailRecipeId,
                  actionId: actions.find(
                    // @ts-expect-error - For old versions, where the actionId does not exist
                    (action) => action.name == (step.tool == 'PESTLE' ? 'MUDDLE' : step.tool == 'POUR' ? 'WITHOUT' : step.tool),
                  )!.id,
                };
              } else {
                step.actionId = actionMapping.find((gm) => gm.id === step.actionId)!.newId;
              }
              return step;
            });
            await transaction.cocktailRecipeStep.createMany({ data: cocktailRecipeSteps, skipDuplicates: true });
          }

          if (data.cocktailRecipeGarnish?.length > 0) {
            importLogger.step('Importing cocktail recipe garnishes', { count: data.cocktailRecipeGarnish.length });
            data.cocktailRecipeGarnish?.forEach((g) => {
              g.cocktailRecipeId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailRecipeId)!.newId;
              g.garnishId = garnishMapping.find((gm) => gm.id === g.garnishId)!.newId;
            });

            await transaction.cocktailRecipeGarnish.createMany({
              data: data.cocktailRecipeGarnish,
              skipDuplicates: true,
            });
          }
          if (data.cocktailRecipeIngredient?.length > 0) {
            importLogger.step('Importing cocktail recipe ingredients', { count: data.cocktailRecipeIngredient.length });
            for (const g of data.cocktailRecipeIngredient) {
              g.id = randomUUID();
              g.cocktailRecipeStepId = cocktailRecipeStepMapping.find((gm) => gm.id === g.cocktailRecipeStepId)!.newId;
              g.ingredientId = ingredientMapping.find((gm) => gm.id === g.ingredientId)!.newId;
              if (g.unitId != undefined) {
                const mappedUnitId = unitMapping.find((gm) => gm.id === g.unitId)?.newId;
                if (mappedUnitId != undefined) {
                  g.unitId = mappedUnitId;
                } else {
                  importLogger.step('Missing unit reference while importing cocktail recipe ingredient', {
                    unitId: g.unitId,
                    cocktailRecipeStepId: g.cocktailRecipeStepId,
                  });
                  g.unitId = null;
                }
              }
              // @ts-expect-error causing older backup version support
              if (g.unit != undefined) {
                // @ts-expect-error causing older backup version support
                const unitIdentifier = convertUnit(g.unit);
                const unit = await transaction.unit.findFirst({ where: { name: unitIdentifier, workspaceId: workspaceId } });
                let unitId = unit?.id;
                if (unitId == undefined) {
                  unitId = randomUUID();
                  await transaction.unit.create({ data: { id: unitId, name: unitIdentifier, workspaceId: workspaceId } });
                }
                g.unitId = unitId;
              }
              // @ts-expect-error causing older backup version support
              g.unit = undefined;
            }
            await transaction.cocktailRecipeIngredient.createMany({
              data: data.cocktailRecipeIngredient,
              skipDuplicates: true,
            });
          }

          const cocktailCardMapping: { id: string; newId: string }[] = [];
          if (data.cocktailCard?.length > 0) {
            importLogger.step('Importing cocktail cards', { count: data.cocktailCard.length });
            data.cocktailCard?.forEach((g) => {
              const cocktailCardMappingItem = { id: g.id, newId: randomUUID() };
              g.id = cocktailCardMappingItem.newId;
              g.workspaceId = workspaceId;
              cocktailCardMapping.push(cocktailCardMappingItem);
            });
            await transaction.cocktailCard.createMany({ data: data.cocktailCard, skipDuplicates: true });
          }

          const cocktailCardGroupMapping: { id: string; newId: string }[] = [];
          if (data.cocktailCardGroup?.length > 0) {
            importLogger.step('Importing cocktail card groups', { count: data.cocktailCardGroup.length });
            data.cocktailCardGroup?.forEach((g) => {
              const cocktailCardGroupMappingItem = { id: g.id, newId: randomUUID() };
              g.id = cocktailCardGroupMappingItem.newId;
              g.cocktailCardId = cocktailCardMapping.find((gm) => gm.id === g.cocktailCardId)!.newId;
              cocktailCardGroupMapping.push(cocktailCardGroupMappingItem);
            });
            await transaction.cocktailCardGroup.createMany({ data: data.cocktailCardGroup, skipDuplicates: true });
          }

          if (data.cocktailCardGroupItem?.length > 0) {
            importLogger.step('Importing cocktail card group items', { count: data.cocktailCardGroupItem.length });
            data.cocktailCardGroupItem?.forEach((g) => {
              g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)!.newId;
              g.cocktailCardGroupId = cocktailCardGroupMapping.find((gm) => gm.id === g.cocktailCardGroupId)!.newId;
            });
            await transaction.cocktailCardGroupItem.createMany({
              data: data.cocktailCardGroupItem,
              skipDuplicates: true,
            });
          }

          const cocktailCalculationGroupMapping: { id: string; newId: string }[] = [];
          if (data.calculationGroups?.length > 0) {
            importLogger.step('Importing calculation groups', { count: data.calculationGroups.length });
            for (const group of data.calculationGroups) {
              const existingGroup = await transaction.cocktailCalculationGroup.findFirst({
                where: { workspaceId, name: group.name },
              });
              if (existingGroup) {
                cocktailCalculationGroupMapping.push({ id: group.id, newId: existingGroup.id });
                await transaction.cocktailCalculationGroup.update({
                  where: { id: existingGroup.id },
                  data: { isDefaultExpanded: group.isDefaultExpanded },
                });
              } else {
                const newId = randomUUID();
                cocktailCalculationGroupMapping.push({ id: group.id, newId });
                await transaction.cocktailCalculationGroup.create({
                  data: {
                    id: newId,
                    name: group.name,
                    workspaceId,
                    isDefaultExpanded: group.isDefaultExpanded,
                  },
                });
              }
            }
          }

          const cocktailCalculationMapping: { id: string; newId: string }[] = [];
          if (data.calculation?.length > 0) {
            importLogger.step('Importing calculations', { count: data.calculation.length });
            data.calculation?.forEach((g) => {
              const cocktailCalculationMappingItem = { id: g.id, newId: randomUUID() };
              g.id = cocktailCalculationMappingItem.newId;
              g.workspaceId = workspaceId;
              g.updatedByUserId = user.id;
              g.groupId = g.groupId ? (cocktailCalculationGroupMapping.find((gm) => gm.id === g.groupId)?.newId ?? null) : null;
              cocktailCalculationMapping.push(cocktailCalculationMappingItem);
            });
            await transaction.cocktailCalculation.createMany({ data: data.calculation, skipDuplicates: true });
          }

          if (data.calculationItems?.length > 0) {
            importLogger.step('Importing calculation items', { count: data.calculationItems.length });
            data.calculationItems?.forEach((g) => {
              g.cocktailId = cocktailRecipeMapping.find((gm) => gm.id === g.cocktailId)!.newId;
              g.calculationId = cocktailCalculationMapping.find((gm) => gm.id === g.calculationId)!.newId;
            });
            await transaction.cocktailCalculationItems.createMany({ data: data.calculationItems, skipDuplicates: true });
          }

          const signageRecords = data.signage ?? [];
          if (signageRecords.length > 0) {
            importLogger.step('Importing signage', { count: signageRecords.length });
            for (const signageRecord of signageRecords) {
              const normalizedSignage = normalizeSignageRecord(signageRecord, workspaceId);
              await transaction.signage.upsert({
                where: {
                  workspaceId_format: {
                    workspaceId,
                    format: signageRecord.format,
                  },
                },
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
                await transaction.signageSlide.create({
                  data: normalizeSignageSlide(
                    {
                      format: signageRecord.format,
                      content: legacyContent,
                      order: 0,
                    },
                    workspaceId,
                  ),
                });
              }
            }
          }

          const signageSlideRecords = data.signageSlides ?? [];
          /** New slide id → guest menu id from the backup (remapped after the guest menu import). */
          const signageSlideMenuLinks: { slideId: string; backupMenuId: string }[] = [];
          if (signageSlideRecords.length > 0) {
            importLogger.step('Importing signage slides', { count: signageSlideRecords.length });
            for (const slide of signageSlideRecords) {
              await ensureSignageContainer(transaction, workspaceId, slide.format as MonitorFormat);
              const created = await transaction.signageSlide.create({
                data: normalizeSignageSlide(slide, workspaceId),
              });
              if (slide.type === 'GUEST_MENU' && slide.guestMenuId) {
                signageSlideMenuLinks.push({ slideId: created.id, backupMenuId: slide.guestMenuId });
              }
            }
          }

          const tagCategoryMapping: { id: string; newId: string }[] = [];
          if ((data.tagCategories?.length ?? 0) > 0) {
            importLogger.step('Importing tag categories', { count: data.tagCategories!.length });
            const existingCategories = await transaction.tagCategory.findMany({ where: { workspaceId } });
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
                tagCategoryMapping.push({ id: category.id, newId: existing.id });
              } else {
                const created = await transaction.tagCategory.create({
                  data: {
                    workspaceId,
                    name: (category.name ?? {}) as Prisma.InputJsonValue,
                    order: category.order ?? 0,
                    showAsGuestFilter: category.showAsGuestFilter ?? true,
                  },
                });
                existingCategories.push(created);
                tagCategoryMapping.push({ id: category.id, newId: created.id });
              }
            }
          }

          if ((data.tagDefinitions?.length ?? 0) > 0) {
            importLogger.step('Importing tag definitions', { count: data.tagDefinitions!.length });
            for (const definition of data.tagDefinitions!) {
              const values = {
                label: definition.label == null ? Prisma.DbNull : (definition.label as Prisma.InputJsonValue),
                categoryId: definition.categoryId ? (tagCategoryMapping.find((cm) => cm.id === definition.categoryId)?.newId ?? null) : null,
                color: definition.color ?? null,
                isPublic: definition.isPublic ?? true,
              };
              await transaction.tagDefinition.upsert({
                where: { workspaceId_tag: { workspaceId, tag: definition.tag } },
                create: { workspaceId, tag: definition.tag, ...values },
                update: values,
              });
            }
          }

          const mapTranslations = <T extends { locale: string }>(rows: T[] | undefined, getId: (row: T) => string, mapping: { id: string; newId: string }[]) =>
            (rows ?? []).flatMap((row) => {
              const newId = mapping.find((m) => m.id === getId(row))?.newId;
              return newId ? [{ row, newId }] : [];
            });
          const cocktailTranslations = mapTranslations(data.cocktailRecipeTranslations, (row) => row.cocktailId, cocktailRecipeMapping);
          const ingredientTranslations = mapTranslations(data.ingredientTranslations, (row) => row.ingredientId, ingredientMapping);
          const garnishTranslations = mapTranslations(data.garnishTranslations, (row) => row.garnishId, garnishMapping);
          const glassTranslations = mapTranslations(data.glassTranslations, (row) => row.glassId, glassMapping);
          if (cocktailTranslations.length + ingredientTranslations.length + garnishTranslations.length + glassTranslations.length > 0) {
            importLogger.step('Importing content translations', {
              cocktails: cocktailTranslations.length,
              ingredients: ingredientTranslations.length,
              garnishes: garnishTranslations.length,
              glasses: glassTranslations.length,
            });
            await transaction.cocktailRecipeTranslation.createMany({
              data: cocktailTranslations.map(({ row, newId }) => ({
                cocktailId: newId,
                locale: row.locale,
                name: row.name ?? null,
                description: row.description ?? null,
                history: row.history ?? null,
              })),
              skipDuplicates: true,
            });
            await transaction.ingredientTranslation.createMany({
              data: ingredientTranslations.map(({ row, newId }) => ({
                ingredientId: newId,
                locale: row.locale,
                name: row.name ?? null,
                guestName: row.guestName ?? null,
                description: row.description ?? null,
              })),
              skipDuplicates: true,
            });
            await transaction.garnishTranslation.createMany({
              data: garnishTranslations.map(({ row, newId }) => ({
                garnishId: newId,
                locale: row.locale,
                name: row.name ?? null,
                description: row.description ?? null,
              })),
              skipDuplicates: true,
            });
            await transaction.glassTranslation.createMany({
              data: glassTranslations.map(({ row, newId }) => ({ glassId: newId, locale: row.locale, name: row.name ?? null })),
              skipDuplicates: true,
            });
          }

          const guestMenuTemplateMapping = new Map<string, string>();
          if ((data.guestMenuTemplates?.length ?? 0) > 0) {
            importLogger.step('Importing guest menu templates', { count: data.guestMenuTemplates!.length });
            for (const template of data.guestMenuTemplates!) {
              const validated = validateBackupGuestMenuTemplate(template);
              if (!validated.ok) {
                // Menus referencing it fall back to the default template.
                report.skipped.push({ type: 'guestMenuTemplate', name: String(template.name), reason: validated.reason });
                continue;
              }
              const created = await transaction.guestMenuTemplate.create({
                data: { workspaceId, name: validated.value.name, definition: validated.value.definition as Prisma.InputJsonValue },
              });
              guestMenuTemplateMapping.set(template.id, created.id);
            }
          }

          const guestMenuMapping = new Map<string, string>();
          if ((data.guestMenus?.length ?? 0) > 0) {
            importLogger.step('Importing guest menus', { count: data.guestMenus!.length });
            const idMaps = {
              cocktails: new Map(cocktailRecipeMapping.map((m) => [m.id, m.newId])),
              ingredients: new Map(ingredientMapping.map((m) => [m.id, m.newId])),
              cardGroups: new Map(cocktailCardGroupMapping.map((m) => [m.id, m.newId])),
              templates: guestMenuTemplateMapping,
            };
            const takenSlugs = new Set((await transaction.guestMenu.findMany({ where: { workspaceId }, select: { slug: true } })).map((menu) => menu.slug));
            for (const menu of data.guestMenus!) {
              const draft = prepareBackupGuestMenuDocument(menu.draft, idMaps);
              if (!draft.ok) {
                report.skipped.push({ type: 'guestMenu', name: String(menu.name), reason: draft.reason });
                continue;
              }
              const baseSlug = normalizeBackupGuestMenuSlug(menu.slug);
              let slug = baseSlug;
              for (let i = 2; takenSlugs.has(slug); i++) slug = `${baseSlug}-${i}`;
              takenSlugs.add(slug);
              const sourceCardId = menu.sourceCardId ? (cocktailCardMapping.find((m) => m.id === menu.sourceCardId)?.newId ?? null) : null;
              const createdMenu = await transaction.guestMenu.create({
                data: {
                  workspaceId,
                  name: menu.name,
                  slug,
                  // Never live after an import: disabled, unpublished, not default, no access code, new preview token.
                  ...importedGuestMenuSafeState(),
                  priority: menu.priority ?? 0,
                  validFrom: menu.validFrom ?? null,
                  validTo: menu.validTo ?? null,
                  weekdays: menu.weekdays ?? [],
                  timeFrom: menu.timeFrom ?? null,
                  timeTo: menu.timeTo ?? null,
                  inactiveBehavior: menu.inactiveBehavior ?? 'NOTICE_WITH_LINK',
                  sourceMode: menu.sourceMode === 'FIXED_CARD' && !sourceCardId ? 'NONE' : (menu.sourceMode ?? 'NONE'),
                  sourceCardId,
                  locales: menu.locales ?? [],
                  draft: draft.value as Prisma.InputJsonValue,
                },
              });
              guestMenuMapping.set(menu.id, createdMenu.id);
            }
          }

          // Guest menu signage slides: point to the re-created menus (unknown menus → active menu).
          for (const link of signageSlideMenuLinks) {
            const guestMenuId = guestMenuMapping.get(link.backupMenuId);
            if (guestMenuId) await transaction.signageSlide.update({ where: { id: link.slideId }, data: { guestMenuId } });
          }

          importLogger.step('Import transaction finished', { skipped: report.skipped.length });
        },
        { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
      );

      importLogger.step('Import request completed successfully');
      return res.status(200).json({ msg: 'Success', report });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }
});
