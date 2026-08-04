/**
 * Version-agnostic business logic for calculations (cocktail calculations +
 * groups, v1). Same DB operations as the legacy handlers, but returns clean
 * public DTOs (lib/api/dto/calculations.ts). Legacy routes remain
 * wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { ApiError } from '@lib/http/ApiError';
import { toCalculationDto, toCalculationGroupDto, toCalculationSummaryDto } from '@lib/api/dto/calculations';
import { Prisma } from '@generated/prisma/client';
import packageJson from '../../../package.json';
import type { CocktailCalculationExportStructure } from '@lib/auditExport';
import type { User, Workspace } from '@generated/prisma/client';
import type {
  CalculationCreateInput,
  CalculationDto,
  CalculationExportJsonInput,
  CalculationGroupAssignInput,
  CalculationGroupCreateInput,
  CalculationGroupDto,
  CalculationGroupUpdateInput,
  CalculationImportJsonInput,
  CalculationSummaryDto,
  CalculationUpdateInput,
} from '@lib/schemas/calculations';

/** Slim include tree that satisfies `toCalculationSummaryDto`. */
const summaryInclude = {
  group: true,
  cocktailCalculationItems: { include: { cocktail: { select: { id: true, name: true } } } },
} satisfies Prisma.CocktailCalculationInclude;

/** Full include tree that satisfies `toCalculationDto` (adds ingredient shopping units). */
const fullInclude = {
  group: true,
  cocktailCalculationItems: { include: { cocktail: { select: { id: true, name: true } } } },
  ingredientShoppingUnits: { include: { ingredient: { select: { id: true, name: true } }, unit: { select: { id: true, name: true } } } },
} satisfies Prisma.CocktailCalculationInclude;

/** Include for the audit-log snapshots, faithful to the legacy handlers. */
const logInclude = {
  cocktailCalculationItems: { include: { cocktail: { select: { name: true } } } },
  ingredientShoppingUnits: { include: { ingredient: { select: { name: true } }, unit: { select: { name: true } } } },
} satisfies Prisma.CocktailCalculationInclude;

export async function listCalculations(workspace: Workspace): Promise<CalculationSummaryDto[]> {
  const calculations = await prisma.cocktailCalculation.findMany({
    where: { workspaceId: workspace.id },
    include: summaryInclude,
  });
  return calculations.map(toCalculationSummaryDto);
}

export async function getCalculation(workspace: Workspace, calculationId: string): Promise<CalculationDto | null> {
  const calculation = await prisma.cocktailCalculation.findUnique({
    where: { id: calculationId, workspaceId: workspace.id },
    include: fullInclude,
  });
  return calculation ? toCalculationDto(calculation) : null;
}

export async function createCalculation(workspace: Workspace, user: User, input: CalculationCreateInput): Promise<CalculationSummaryDto> {
  const created = await prisma.$transaction(async (tx) => {
    let targetGroupId: string | null = null;
    if (input.groupId) {
      const group = await tx.cocktailCalculationGroup.findFirst({
        where: { id: input.groupId, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!group) {
        throw new ApiError(400, 'INVALID_GROUP', 'Ungültige Gruppe');
      }
      targetGroupId = group.id;
    }

    const data: Prisma.CocktailCalculationCreateInput = {
      name: input.name,
      showSalesStuff: input.showSalesStuff,
      cocktailCalculationItems: {
        create: input.calculationItems.map((item) => ({
          plannedAmount: item.plannedAmount,
          customPrice: item.customPrice ?? undefined,
          cocktail: { connect: { id: item.cocktailId } },
        })),
      },
      workspace: { connect: { id: workspace.id } },
      ingredientShoppingUnits: {
        create: input.ingredientShoppingUnits.map((unit) => ({
          ingredient: { connect: { id: unit.ingredientId } },
          unit: { connect: { id: unit.unitId } },
          checked: unit.checked,
        })),
      },
      updatedByUser: { connect: { id: user.id } },
      ...(targetGroupId ? { group: { connect: { id: targetGroupId } } } : {}),
    };

    const createdCalculation = await tx.cocktailCalculation.create({ data, include: logInclude });
    await createLog(tx, workspace.id, user.id, 'CocktailCalculation', createdCalculation.id, 'CREATE', null, createdCalculation);

    return tx.cocktailCalculation.findUniqueOrThrow({ where: { id: createdCalculation.id }, include: summaryInclude });
  });

  return toCalculationSummaryDto(created);
}

export async function updateCalculation(
  workspace: Workspace,
  user: User,
  calculationId: string,
  input: CalculationUpdateInput,
): Promise<CalculationSummaryDto> {
  const updated = await prisma.$transaction(async (tx) => {
    let targetGroupId: string | null = null;
    if (input.groupId) {
      const group = await tx.cocktailCalculationGroup.findFirst({
        where: { id: input.groupId, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!group) {
        throw new ApiError(400, 'INVALID_GROUP', 'Ungültige Gruppe');
      }
      targetGroupId = group.id;
    }

    const oldCalculation = await tx.cocktailCalculation.findUnique({ where: { id: calculationId }, include: logInclude });

    const data: Prisma.CocktailCalculationUpdateInput = {
      id: calculationId,
      name: input.name,
      showSalesStuff: input.showSalesStuff,
      updatedByUser: { connect: { id: user.id } },
      cocktailCalculationItems: {
        create: input.calculationItems.map((item) => ({
          plannedAmount: item.plannedAmount,
          customPrice: item.customPrice ?? undefined,
          cocktail: { connect: { id: item.cocktailId } },
        })),
      },
      ingredientShoppingUnits: {
        create: input.ingredientShoppingUnits.map((unit) => ({
          ingredient: { connect: { id: unit.ingredientId } },
          unit: { connect: { id: unit.unitId } },
          checked: unit.checked,
        })),
      },
      group: targetGroupId ? { connect: { id: targetGroupId } } : { disconnect: true },
    };

    await tx.cocktailCalculationItems.deleteMany({ where: { calculationId } });
    await tx.calculationIngredientShoppingUnit.deleteMany({ where: { cocktailCalculationId: calculationId } });

    const updatedCalculation = await tx.cocktailCalculation.update({ where: { id: calculationId }, data, include: logInclude });
    await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'UPDATE', oldCalculation, updatedCalculation);

    return tx.cocktailCalculation.findUniqueOrThrow({ where: { id: calculationId }, include: summaryInclude });
  });

  return toCalculationSummaryDto(updated);
}

export async function deleteCalculation(workspace: Workspace, user: User, calculationId: string): Promise<{ count: number }> {
  await prisma.$transaction(async (tx) => {
    const oldCalculation = await tx.cocktailCalculation.findUnique({ where: { id: calculationId }, include: logInclude });
    await tx.cocktailCalculation.delete({ where: { id: calculationId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'DELETE', oldCalculation, null);
  });

  return { count: 1 };
}

export async function listCalculationGroups(workspace: Workspace): Promise<CalculationGroupDto[]> {
  const groups = await prisma.cocktailCalculationGroup.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { calculations: true } } },
    orderBy: [{ name: 'asc' }],
  });
  return groups.map(toCalculationGroupDto);
}

export async function createCalculationGroup(workspace: Workspace, input: CalculationGroupCreateInput): Promise<CalculationGroupDto> {
  try {
    const group = await prisma.cocktailCalculationGroup.create({
      data: {
        name: input.name.trim(),
        isDefaultExpanded: Boolean(input.isDefaultExpanded),
        workspaceId: workspace.id,
      },
      include: { _count: { select: { calculations: true } } },
    });
    return toCalculationGroupDto(group);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ApiError(409, 'GROUP_NAME_TAKEN', 'Eine Gruppe mit diesem Namen existiert bereits');
    }
    throw error;
  }
}

export async function updateCalculationGroup(workspace: Workspace, groupId: string, input: CalculationGroupUpdateInput): Promise<CalculationGroupDto> {
  const existing = await prisma.cocktailCalculationGroup.findFirst({ where: { id: groupId, workspaceId: workspace.id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Gruppe nicht gefunden');
  }

  try {
    const updated = await prisma.cocktailCalculationGroup.update({
      where: { id: groupId },
      data: {
        name: input.name.trim(),
        isDefaultExpanded: Boolean(input.isDefaultExpanded),
      },
      include: { _count: { select: { calculations: true } } },
    });
    return toCalculationGroupDto(updated);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ApiError(409, 'GROUP_NAME_TAKEN', 'Eine Gruppe mit diesem Namen existiert bereits');
    }
    throw error;
  }
}

export async function deleteCalculationGroup(workspace: Workspace, groupId: string): Promise<{ count: number }> {
  const existing = await prisma.cocktailCalculationGroup.findFirst({ where: { id: groupId, workspaceId: workspace.id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Gruppe nicht gefunden');
  }

  await prisma.cocktailCalculationGroup.delete({ where: { id: groupId } });
  return { count: 1 };
}

export async function assignCalculationsToGroup(workspace: Workspace, input: CalculationGroupAssignInput): Promise<{ updatedCount: number }> {
  if (input.groupId) {
    const group = await prisma.cocktailCalculationGroup.findFirst({ where: { id: input.groupId, workspaceId: workspace.id } });
    if (!group) {
      throw new ApiError(404, 'NOT_FOUND', 'Gruppe nicht gefunden');
    }
  }

  // Use raw SQL to avoid Prisma @updatedAt side effects on pure group assignment.
  const updatedCount = await prisma.$executeRaw(
    Prisma.sql`
    UPDATE "CocktailCalculation"
    SET "groupId" = ${input.groupId ?? null}
    WHERE "workspaceId" = ${workspace.id}
      AND "id" IN (${Prisma.join(input.calculationIds)})
  `,
  );

  return { updatedCount };
}

// ────────────── Import / Export (JSON) ──────────────
// Faithful replication of the legacy handlers
// (pages/api/workspaces/[workspaceId]/calculations/{export,import}-json.tsx).
// The response payloads are round-trip formats and are returned VERBATIM
// (not wrapped in a data envelope) — hence the loose `unknown` return types.

interface CalculationImportEntityDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  groupDecision?: 'keep-exported' | 'use-existing' | 'create-new' | 'no-group';
  existingGroupId?: string;
  newGroupName?: string;
  newGroupDefaultExpanded?: boolean;
  data: Record<string, unknown>;
}

interface CalculationImportEntityMapping {
  exportName: string;
  decision: 'use-existing' | 'skip';
  existingId?: string;
}

/**
 * Exports the given calculations to the round-trip JSON structure. Returns a
 * single object when exactly one calculation is exported, otherwise an array
 * (matching the legacy endpoint exactly).
 */
export async function exportCalculationsJson(workspace: Workspace, input: CalculationExportJsonInput): Promise<unknown> {
  const { ids } = input;

  if (!ids || ids.length === 0) {
    throw new ApiError(400, 'NO_CALCULATIONS_SELECTED', 'Keine Kalkulationen ausgewählt');
  }

  const calculations = await prisma.cocktailCalculation.findMany({
    where: { id: { in: ids }, workspaceId: workspace.id },
    include: {
      group: true,
      cocktailCalculationItems: { include: { cocktail: { select: { name: true } } } },
      ingredientShoppingUnits: { include: { ingredient: { select: { name: true } }, unit: { select: { name: true } } } },
    },
  });

  if (calculations.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Keine Kalkulationen gefunden');
  }

  const exportData: CocktailCalculationExportStructure[] = calculations.map((calc) => ({
    exportVersion: packageJson.version,
    exportDate: new Date().toISOString(),
    calculation: {
      id: calc.id,
      name: calc.name,
      showSalesStuff: calc.showSalesStuff,
      workspaceId: calc.workspaceId,
      updatedByUserId: calc.updatedByUserId,
      groupId: calc.groupId,
      groupName: calc.group?.name ?? null,
    },
    cocktailCalculationItems: calc.cocktailCalculationItems.map((item) => ({
      calculationId: calc.id,
      cocktailId: item.cocktailId,
      cocktailName: item.cocktail?.name || item.cocktailId,
      plannedAmount: item.plannedAmount,
      customPrice: item.customPrice,
    })),
    ingredientShoppingUnits: calc.ingredientShoppingUnits.map((su) => ({
      ingredientId: su.ingredientId,
      ingredientName: su.ingredient?.name || su.ingredientId,
      unitId: su.unitId,
      unitName: su.unit?.name || su.unitId,
      checked: su.checked,
      cocktailCalculationId: calc.id,
    })),
  }));

  return exportData.length === 1 ? exportData[0] : exportData;
}

/**
 * Three-phase import (validate → prepare-mapping → execute) of a calculation
 * export dump. The response shape depends on the phase and is returned verbatim.
 */
export async function importCalculationsJson(workspace: Workspace, user: User, input: CalculationImportJsonInput): Promise<unknown> {
  const { phase } = input as { phase: 'validate' | 'prepare-mapping' | 'execute' };
  const exportData = input.exportData as CocktailCalculationExportStructure | CocktailCalculationExportStructure[];
  const decisions = input.decisions as CalculationImportEntityDecision[] | undefined;
  const cocktailMappings = input.cocktailMappings as CalculationImportEntityMapping[] | undefined;
  const ingredientMappings = input.ingredientMappings as CalculationImportEntityMapping[] | undefined;
  const unitMappings = input.unitMappings as CalculationImportEntityMapping[] | undefined;

  const workspaceId = workspace.id;

  const items: CocktailCalculationExportStructure[] = Array.isArray(exportData) ? exportData : [exportData];

  if (phase === 'validate') {
    const entities = items.map((item) => {
      if (!item?.calculation?.name) {
        return { name: 'Unbekannt', valid: false };
      }
      return { name: item.calculation.name, valid: true };
    });

    return { valid: entities.every((e) => e.valid), entities };
  }

  if (phase === 'prepare-mapping') {
    const existingCalculations = await prisma.cocktailCalculation.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const existingIngredients = await prisma.ingredient.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const existingUnits = await prisma.unit.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const existingCocktails = await prisma.cocktailRecipe.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const calculationGroups = await prisma.cocktailCalculationGroup.findMany({
      where: { workspaceId },
      select: { id: true, name: true, isDefaultExpanded: true },
      orderBy: { name: 'asc' },
    });

    const entities = items.map((item) => {
      const name = item.calculation?.name || 'Unbekannt';
      const conflicts = existingCalculations.filter((e) => e.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        data: item,
        conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })),
      };
    });

    const referencedIngredientNames = new Set<string>();
    const referencedUnitNames = new Set<string>();
    const referencedCocktailNames = new Set<string>();

    for (const item of items) {
      if (item.ingredientShoppingUnits) {
        for (const su of item.ingredientShoppingUnits) {
          if (su.ingredientName) referencedIngredientNames.add(su.ingredientName);
          if (su.unitName) referencedUnitNames.add(su.unitName);
        }
      }
      if (item.cocktailCalculationItems) {
        for (const ci of item.cocktailCalculationItems) {
          if (ci.cocktailName) referencedCocktailNames.add(ci.cocktailName);
        }
      }
    }

    const ingredientMatches = Array.from(referencedIngredientNames).map((name) => {
      const match = existingIngredients.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return {
        exportName: name,
        autoMatch: match ? { id: match.id, name: match.name } : null,
        options: existingIngredients.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
      };
    });

    const unitMatches = Array.from(referencedUnitNames).map((name) => {
      const match = existingUnits.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return {
        exportName: name,
        autoMatch: match ? { id: match.id, name: match.name } : null,
        options: existingUnits.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
      };
    });

    const cocktailMatches = Array.from(referencedCocktailNames).map((name) => {
      const match = existingCocktails.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return {
        exportName: name,
        autoMatch: match ? { id: match.id, name: match.name } : null,
        options: existingCocktails.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
      };
    });

    return {
      entities,
      ingredientMatches,
      unitMatches,
      cocktailMatches,
      calculationGroups,
    };
  }

  if (phase === 'execute') {
    if (!decisions || decisions.length === 0) {
      throw new ApiError(400, 'NO_DECISIONS', 'Keine Entscheidungen angegeben');
    }

    const cocktailNameToId = new Map<string, string>();
    if (cocktailMappings) {
      for (const m of cocktailMappings) {
        if (m.decision === 'use-existing' && m.existingId) {
          cocktailNameToId.set(m.exportName.toLowerCase(), m.existingId);
        }
      }
    }

    const ingredientNameToId = new Map<string, string>();
    if (ingredientMappings) {
      for (const m of ingredientMappings) {
        if (m.decision === 'use-existing' && m.existingId) {
          ingredientNameToId.set(m.exportName.toLowerCase(), m.existingId);
        }
      }
    }

    const unitNameToId = new Map<string, string>();
    if (unitMappings) {
      for (const m of unitMappings) {
        if (m.decision === 'use-existing' && m.existingId) {
          unitNameToId.set(m.exportName.toLowerCase(), m.existingId);
        }
      }
    }

    const results: Array<{ name: string; status: string; message?: string }> = [];

    await prisma.$transaction(async (tx) => {
      const existingIngredients = await tx.ingredient.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      });
      const existingUnits = await tx.unit.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      });
      const existingCocktails = await tx.cocktailRecipe.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      });
      const existingGroups = await tx.cocktailCalculationGroup.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      });

      for (const decision of decisions) {
        if (decision.decision === 'skip') {
          results.push({ name: decision.exportName, status: 'skipped' });
          continue;
        }

        const itemData = decision.data as unknown as CocktailCalculationExportStructure;
        if (!itemData?.calculation) continue;

        const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.calculation.name;
        let targetGroupId: string | null = null;
        const groupDecision = decision.groupDecision ?? 'keep-exported';

        if (groupDecision === 'use-existing' && decision.existingGroupId) {
          const existingGroup = existingGroups.find((g) => g.id === decision.existingGroupId);
          if (existingGroup) {
            targetGroupId = existingGroup.id;
          }
        } else if (groupDecision === 'create-new') {
          const newGroupName = decision.newGroupName?.trim();
          if (newGroupName) {
            const existingGroup = existingGroups.find((g) => g.name.toLowerCase() === newGroupName.toLowerCase());
            if (existingGroup) {
              targetGroupId = existingGroup.id;
            } else {
              const createdGroup = await tx.cocktailCalculationGroup.create({
                data: {
                  name: newGroupName,
                  workspaceId,
                  isDefaultExpanded: Boolean(decision.newGroupDefaultExpanded),
                },
              });
              existingGroups.push({ id: createdGroup.id, name: createdGroup.name });
              targetGroupId = createdGroup.id;
            }
          }
        } else if (groupDecision === 'keep-exported') {
          const exportedGroupName = itemData.calculation.groupName?.trim();
          if (exportedGroupName) {
            const existingGroup = existingGroups.find((g) => g.name.toLowerCase() === exportedGroupName.toLowerCase());
            if (existingGroup) {
              targetGroupId = existingGroup.id;
            } else {
              const createdGroup = await tx.cocktailCalculationGroup.create({
                data: {
                  name: exportedGroupName,
                  workspaceId,
                  isDefaultExpanded: false,
                },
              });
              existingGroups.push({ id: createdGroup.id, name: createdGroup.name });
              targetGroupId = createdGroup.id;
            }
          }
        }

        try {
          let calcId: string;

          if (decision.decision === 'overwrite' && decision.existingId) {
            await tx.cocktailCalculationItems.deleteMany({
              where: { calculationId: decision.existingId },
            });
            await tx.calculationIngredientShoppingUnit.deleteMany({
              where: { cocktailCalculationId: decision.existingId },
            });

            await tx.cocktailCalculation.update({
              where: { id: decision.existingId },
              data: {
                name: finalName,
                showSalesStuff: itemData.calculation.showSalesStuff ?? false,
                updatedByUserId: user.id,
                groupId: targetGroupId,
              },
            });

            calcId = decision.existingId;
          } else {
            const created = await tx.cocktailCalculation.create({
              data: {
                name: finalName,
                showSalesStuff: itemData.calculation.showSalesStuff ?? false,
                workspaceId,
                updatedByUserId: user.id,
                groupId: targetGroupId,
              },
            });
            calcId = created.id;
          }

          if (itemData.cocktailCalculationItems) {
            for (const ci of itemData.cocktailCalculationItems) {
              const cocktailName = ci.cocktailName;
              const mappedId = cocktailNameToId.get(cocktailName.toLowerCase());
              if (!mappedId) continue;
              const cocktail = existingCocktails.find((c) => c.id === mappedId);
              if (!cocktail) continue;

              await tx.cocktailCalculationItems.create({
                data: {
                  calculationId: calcId,
                  cocktailId: cocktail.id,
                  plannedAmount: ci.plannedAmount,
                  customPrice: ci.customPrice ?? null,
                },
              });
            }
          }

          if (itemData.ingredientShoppingUnits) {
            for (const su of itemData.ingredientShoppingUnits) {
              let ingredientId = ingredientNameToId.get(su.ingredientName.toLowerCase());
              if (!ingredientId) {
                const match = existingIngredients.find((i) => i.name.toLowerCase() === su.ingredientName.toLowerCase());
                ingredientId = match?.id;
              }
              if (!ingredientId) continue;

              let unitId = unitNameToId.get(su.unitName.toLowerCase());
              if (!unitId) {
                const match = existingUnits.find((u) => u.name.toLowerCase() === su.unitName.toLowerCase());
                if (match) {
                  unitId = match.id;
                } else {
                  const newUnit = await tx.unit.create({
                    data: { name: su.unitName, workspaceId },
                  });
                  unitId = newUnit.id;
                  existingUnits.push({ id: newUnit.id, name: su.unitName });
                }
              }

              await tx.calculationIngredientShoppingUnit.create({
                data: {
                  cocktailCalculationId: calcId,
                  ingredientId,
                  unitId,
                  checked: su.checked ?? false,
                },
              });
            }
          }

          const fullResult = await tx.cocktailCalculation.findUnique({
            where: { id: calcId },
            include: {
              cocktailCalculationItems: {
                include: { cocktail: { select: { name: true } } },
              },
              ingredientShoppingUnits: {
                include: {
                  ingredient: { select: { name: true } },
                  unit: { select: { name: true } },
                },
              },
            },
          });

          const action = decision.decision === 'overwrite' ? 'UPDATE' : 'CREATE';
          await createLog(tx, workspaceId, user.id, 'CocktailCalculation', calcId, action as 'CREATE' | 'UPDATE', null, fullResult);
          results.push({ name: finalName, status: decision.decision === 'overwrite' ? 'overwritten' : 'created' });
        } catch (err: unknown) {
          results.push({ name: finalName, status: 'error', message: err instanceof Error ? err.message : 'Unbekannter Fehler' });
        }
      }
    });

    return { success: true, results };
  }

  throw new ApiError(400, 'INVALID_PHASE', 'Ungültige Phase');
}
