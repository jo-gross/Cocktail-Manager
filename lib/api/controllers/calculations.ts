/**
 * Version-agnostic business logic for calculations (cocktail calculations +
 * groups, v1). Returns clean public DTOs (lib/api/dto/calculations.ts). Every
 * path and body id is scoped to the caller's workspace.
 *
 * Calculations record the updating user in a required FK (`updatedByUserId`),
 * so writes by the instance master key (no user row) are rejected with 403.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { ApiError } from '@lib/http/ApiError';
import { MASTER_API_KEY_USER_ID } from '@lib/http/requestAuth';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { BULK_TX_TIMEOUT_MS, lockWorkspaceScope, runTx, type Db, type Tx } from '@lib/db/tx';
import { toCalculationDto, toCalculationGroupDto, toCalculationSummaryDto } from '@lib/api/dto/calculations';
import { Prisma } from '@generated/prisma/client';
import packageJson from '../../../package.json';
import type { CocktailCalculationExportStructure } from '@lib/auditExport';
import type { User, Workspace } from '@generated/prisma/client';
import { CalculationExportItemSchema, MAX_CALCULATION_IMPORT_ITEMS } from '@lib/schemas/calculations';
import type {
  CalculationCreateInput,
  CalculationDto,
  CalculationExportItem,
  CalculationExportJsonInput,
  CalculationGroupAssignInput,
  CalculationGroupCreateInput,
  CalculationGroupDto,
  CalculationGroupUpdateInput,
  CalculationImportDecision,
  CalculationImportJsonInput,
  CalculationImportMapping,
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

const groupCountInclude = { _count: { select: { calculations: true } } } satisfies Prisma.CocktailCalculationGroupInclude;

/** Calculations need a real user for `updatedByUserId`; the master key has none. */
function assertRealUser(user: User): void {
  if (user.id === MASTER_API_KEY_USER_ID) {
    throw new ApiError(403, 'MASTER_KEY_NOT_ALLOWED', 'The master API key cannot write calculations; use a workspace API key or a user session');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

/**
 * Locks the calculation row for the rest of the transaction (concurrent
 * replace-all updates serialize instead of colliding on the item keys) and
 * proves it belongs to the workspace (404 otherwise).
 */
async function lockCalculation(tx: Tx, workspaceId: string, calculationId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "CocktailCalculation" WHERE id = ${calculationId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Calculation not found');
}

async function resolveGroupId(db: Db, workspaceId: string, groupId: string | null | undefined): Promise<string | null> {
  if (!groupId) return null;
  const group = await db.cocktailCalculationGroup.findFirst({ where: { id: groupId, workspaceId }, select: { id: true } });
  if (!group) throw new ApiError(400, 'INVALID_GROUP', 'Invalid group');
  return group.id;
}

type CalculationContentInput = Pick<CalculationCreateInput, 'calculationItems' | 'ingredientShoppingUnits'>;

/** Rejects duplicate keys up front (they would violate the composite primary keys). */
function assertNoDuplicateRows(input: CalculationContentInput): void {
  const cocktailIds = input.calculationItems.map((item) => item.cocktailId);
  const unitKeys = input.ingredientShoppingUnits.map((unit) => `${unit.ingredientId}\u0000${unit.unitId}`);
  if (new Set(cocktailIds).size !== cocktailIds.length || new Set(unitKeys).size !== unitKeys.length) {
    throw new ApiError(400, 'DUPLICATE_ITEMS', 'Each cocktail and each ingredient/unit pair may appear only once');
  }
}

async function assertContentInWorkspace(db: Db, workspaceId: string, input: CalculationContentInput): Promise<void> {
  await assertIdsInWorkspace(db, workspaceId, {
    cocktail: input.calculationItems.map((item) => item.cocktailId),
    ingredient: input.ingredientShoppingUnits.map((unit) => unit.ingredientId),
    unit: input.ingredientShoppingUnits.map((unit) => unit.unitId),
  });
}

function itemRows(input: CalculationContentInput) {
  return input.calculationItems.map((item) => ({
    cocktailId: item.cocktailId,
    plannedAmount: item.plannedAmount,
    customPrice: item.customPrice ?? null,
  }));
}

function shoppingUnitRows(input: CalculationContentInput) {
  return input.ingredientShoppingUnits.map((unit) => ({
    ingredientId: unit.ingredientId,
    unitId: unit.unitId,
    checked: unit.checked,
  }));
}

export async function listCalculations(workspace: Workspace): Promise<CalculationSummaryDto[]> {
  const calculations = await prisma.cocktailCalculation.findMany({
    where: { workspaceId: workspace.id },
    include: summaryInclude,
  });
  return calculations.map(toCalculationSummaryDto);
}

export async function getCalculation(workspace: Workspace, calculationId: string): Promise<CalculationDto | null> {
  const calculation = await prisma.cocktailCalculation.findFirst({
    where: { id: calculationId, workspaceId: workspace.id },
    include: fullInclude,
  });
  return calculation ? toCalculationDto(calculation) : null;
}

export async function createCalculation(workspace: Workspace, user: User, input: CalculationCreateInput): Promise<CalculationSummaryDto> {
  assertRealUser(user);
  assertNoDuplicateRows(input);

  const created = await runTx(async (tx) => {
    const groupId = await resolveGroupId(tx, workspace.id, input.groupId);
    await assertContentInWorkspace(tx, workspace.id, input);

    const createdCalculation = await tx.cocktailCalculation.create({
      data: {
        name: input.name,
        showSalesStuff: input.showSalesStuff,
        workspaceId: workspace.id,
        updatedByUserId: user.id,
        groupId,
        cocktailCalculationItems: { createMany: { data: itemRows(input) } },
        ingredientShoppingUnits: { createMany: { data: shoppingUnitRows(input) } },
      },
      include: logInclude,
    });
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
  const updated = await runTx(async (tx) => {
    // Scope first: a foreign or unknown id is a 404 for every caller.
    await lockCalculation(tx, workspace.id, calculationId);
    assertRealUser(user);
    assertNoDuplicateRows(input);
    const groupId = await resolveGroupId(tx, workspace.id, input.groupId);
    await assertContentInWorkspace(tx, workspace.id, input);

    const oldCalculation = await tx.cocktailCalculation.findFirstOrThrow({ where: { id: calculationId, workspaceId: workspace.id }, include: logInclude });

    await tx.cocktailCalculationItems.deleteMany({ where: { calculationId } });
    await tx.calculationIngredientShoppingUnit.deleteMany({ where: { cocktailCalculationId: calculationId } });

    const updatedCalculation = await tx.cocktailCalculation.update({
      where: { id: calculationId, workspaceId: workspace.id },
      data: {
        name: input.name,
        showSalesStuff: input.showSalesStuff,
        updatedByUserId: user.id,
        groupId,
        cocktailCalculationItems: { createMany: { data: itemRows(input) } },
        ingredientShoppingUnits: { createMany: { data: shoppingUnitRows(input) } },
      },
      include: logInclude,
    });
    await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'UPDATE', oldCalculation, updatedCalculation);

    return tx.cocktailCalculation.findUniqueOrThrow({ where: { id: calculationId }, include: summaryInclude });
  });

  return toCalculationSummaryDto(updated);
}

export async function deleteCalculation(workspace: Workspace, user: User, calculationId: string): Promise<{ count: number }> {
  await runTx(async (tx) => {
    const oldCalculation = await tx.cocktailCalculation.findFirst({ where: { id: calculationId, workspaceId: workspace.id }, include: logInclude });
    if (!oldCalculation) throw new ApiError(404, 'NOT_FOUND', 'Calculation not found');
    await tx.cocktailCalculation.delete({ where: { id: calculationId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'DELETE', oldCalculation, null);
  });

  return { count: 1 };
}

export async function listCalculationGroups(workspace: Workspace): Promise<CalculationGroupDto[]> {
  const groups = await prisma.cocktailCalculationGroup.findMany({
    where: { workspaceId: workspace.id },
    include: groupCountInclude,
    orderBy: [{ name: 'asc' }],
  });
  return groups.map(toCalculationGroupDto);
}

export async function createCalculationGroup(workspace: Workspace, input: CalculationGroupCreateInput): Promise<CalculationGroupDto> {
  try {
    const group = await prisma.cocktailCalculationGroup.create({
      data: {
        name: input.name,
        isDefaultExpanded: Boolean(input.isDefaultExpanded),
        workspaceId: workspace.id,
      },
      include: groupCountInclude,
    });
    return toCalculationGroupDto(group);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with this name already exists');
    throw error;
  }
}

export async function updateCalculationGroup(workspace: Workspace, groupId: string, input: CalculationGroupUpdateInput): Promise<CalculationGroupDto> {
  try {
    const { count } = await prisma.cocktailCalculationGroup.updateMany({
      where: { id: groupId, workspaceId: workspace.id },
      data: {
        name: input.name,
        isDefaultExpanded: Boolean(input.isDefaultExpanded),
      },
    });
    if (count === 0) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with this name already exists');
    throw error;
  }

  const updated = await prisma.cocktailCalculationGroup.findFirst({ where: { id: groupId, workspaceId: workspace.id }, include: groupCountInclude });
  if (!updated) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');
  return toCalculationGroupDto(updated);
}

export async function deleteCalculationGroup(workspace: Workspace, groupId: string): Promise<{ count: number }> {
  const { count } = await prisma.cocktailCalculationGroup.deleteMany({ where: { id: groupId, workspaceId: workspace.id } });
  if (count === 0) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');
  return { count };
}

export async function assignCalculationsToGroup(workspace: Workspace, input: CalculationGroupAssignInput): Promise<{ updatedCount: number }> {
  if (input.groupId) {
    const group = await prisma.cocktailCalculationGroup.findFirst({ where: { id: input.groupId, workspaceId: workspace.id }, select: { id: true } });
    if (!group) throw new ApiError(404, 'GROUP_NOT_FOUND', 'Group not found');
  }
  await assertIdsInWorkspace(prisma, workspace.id, { calculation: input.calculationIds });

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
// The response payloads are round-trip formats and are returned VERBATIM
// (not wrapped in a data envelope) — hence the loose `unknown` return types.

/**
 * Exports the given calculations to the round-trip JSON structure. Returns a
 * single object when exactly one calculation is exported, otherwise an array
 * (matching the legacy endpoint exactly).
 */
export async function exportCalculationsJson(workspace: Workspace, input: CalculationExportJsonInput): Promise<unknown> {
  const { ids } = input;

  if (!ids || ids.length === 0) {
    throw new ApiError(400, 'NO_CALCULATIONS_SELECTED', 'No calculations selected');
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
    throw new ApiError(404, 'CALCULATIONS_NOT_FOUND', 'No calculations found');
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

interface ImportItemIssue {
  index?: number;
  name: string;
  issues: unknown;
}

function exportItemName(item: unknown): string {
  const name = (item as { calculation?: { name?: unknown } } | null)?.calculation?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Unbekannt';
}

function invalidImport(issues: ImportItemIssue[]): ApiError {
  return new ApiError(400, 'INVALID_IMPORT_ITEMS', `${issues.length} import item(s) are invalid; nothing was imported.`, issues);
}

function exportItemsOf(exportData: unknown): unknown[] {
  const items = exportData === undefined || exportData === null ? [] : Array.isArray(exportData) ? exportData : [exportData];
  if (items.length > MAX_CALCULATION_IMPORT_ITEMS) {
    throw new ApiError(400, 'TOO_MANY_ITEMS', `At most ${MAX_CALCULATION_IMPORT_ITEMS} calculations can be imported at once`);
  }
  return items;
}

function mappingsToIds(mappings: CalculationImportMapping[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const mapping of mappings ?? []) {
    if (mapping.decision === 'use-existing' && mapping.existingId) map.set(mapping.exportName.toLowerCase(), mapping.existingId);
  }
  return map;
}

function byLowerName<T extends { name: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) if (!map.has(row.name.toLowerCase())) map.set(row.name.toLowerCase(), row);
  return map;
}

type GroupPlan = { kind: 'none' } | { kind: 'existing'; id: string } | { kind: 'by-name'; name: string; isDefaultExpanded: boolean };

interface PlannedCalculation {
  decision: CalculationImportDecision;
  name: string;
  overwriteId: string | null;
  group: GroupPlan;
  showSalesStuff: boolean;
  items: Array<{ cocktailId: string; plannedAmount: number; customPrice: number | null }>;
  /** `unitId` null → the unit `unitName` is matched/created inside the transaction. */
  shoppingUnits: Array<{ ingredientId: string; unitId: string | null; unitName: string; checked: boolean }>;
}

function groupPlanOf(decision: CalculationImportDecision, item: CalculationExportItem): GroupPlan {
  const groupDecision = decision.groupDecision ?? 'keep-exported';
  if (groupDecision === 'use-existing') return decision.existingGroupId ? { kind: 'existing', id: decision.existingGroupId } : { kind: 'none' };
  if (groupDecision === 'create-new') {
    const name = decision.newGroupName?.trim();
    return name ? { kind: 'by-name', name, isDefaultExpanded: Boolean(decision.newGroupDefaultExpanded) } : { kind: 'none' };
  }
  if (groupDecision === 'keep-exported') {
    const name = item.calculation.groupName?.trim();
    return name ? { kind: 'by-name', name, isDefaultExpanded: false } : { kind: 'none' };
  }
  return { kind: 'none' };
}

async function prepareImportMapping(workspaceId: string, rawItems: unknown[]): Promise<unknown> {
  const issues: ImportItemIssue[] = [];
  const items: CalculationExportItem[] = [];
  rawItems.forEach((raw, index) => {
    const parsed = CalculationExportItemSchema.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
    else issues.push({ index, name: exportItemName(raw), issues: parsed.error.issues });
  });
  if (issues.length > 0) throw invalidImport(issues);

  const existingCalculations = await prisma.cocktailCalculation.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingIngredients = await prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingUnits = await prisma.unit.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const existingCocktails = await prisma.cocktailRecipe.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const calculationGroups = await prisma.cocktailCalculationGroup.findMany({
    where: { workspaceId },
    select: { id: true, name: true, isDefaultExpanded: true },
    orderBy: { name: 'asc' },
  });

  const entities = items.map((item, index) => {
    const name = item.calculation.name;
    const conflicts = existingCalculations.filter((e) => e.name.toLowerCase() === name.toLowerCase());
    return { name, data: rawItems[index], conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })) };
  });

  const referencedIngredientNames = new Set<string>();
  const referencedUnitNames = new Set<string>();
  const referencedCocktailNames = new Set<string>();
  for (const item of items) {
    for (const su of item.ingredientShoppingUnits) {
      referencedIngredientNames.add(su.ingredientName);
      referencedUnitNames.add(su.unitName);
    }
    for (const ci of item.cocktailCalculationItems) referencedCocktailNames.add(ci.cocktailName);
  }

  const matchesFor = (names: Set<string>, existing: Array<{ id: string; name: string }>) =>
    Array.from(names).map((name) => {
      const match = existing.find((e) => e.name.toLowerCase() === name.toLowerCase());
      return {
        exportName: name,
        autoMatch: match ? { id: match.id, name: match.name } : null,
        options: existing.filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).map((e) => ({ id: e.id, name: e.name })),
      };
    });

  return {
    entities,
    ingredientMatches: matchesFor(referencedIngredientNames, existingIngredients),
    unitMatches: matchesFor(referencedUnitNames, existingUnits),
    cocktailMatches: matchesFor(referencedCocktailNames, existingCocktails),
    calculationGroups,
  };
}

async function findIds(ids: string[], find: (ids: string[]) => Promise<Array<{ id: string }>>): Promise<Set<string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Set();
  return new Set((await find(unique)).map((row) => row.id));
}

/**
 * Validates every decision and every referenced id before anything is written.
 * Returns the resolved plan or throws 400 INVALID_IMPORT_ITEMS with per-item issues.
 */
async function planImport(workspaceId: string, input: CalculationImportJsonInput): Promise<PlannedCalculation[]> {
  const decisions = input.decisions ?? [];
  const issues: ImportItemIssue[] = [];

  const cocktailMap = mappingsToIds(input.cocktailMappings);
  const ingredientMap = mappingsToIds(input.ingredientMappings);
  const unitMap = mappingsToIds(input.unitMappings);

  const mappingChecks: Array<{ label: string; map: Map<string, string>; found: Set<string> }> = [
    {
      label: 'cocktailMappings',
      map: cocktailMap,
      found: await findIds([...cocktailMap.values()], (ids) =>
        prisma.cocktailRecipe.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
      ),
    },
    {
      label: 'ingredientMappings',
      map: ingredientMap,
      found: await findIds([...ingredientMap.values()], (ids) => prisma.ingredient.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } })),
    },
    {
      label: 'unitMappings',
      map: unitMap,
      found: await findIds([...unitMap.values()], (ids) => prisma.unit.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } })),
    },
  ];
  for (const { label, map, found } of mappingChecks) {
    for (const [exportName, id] of map) {
      if (!found.has(id))
        issues.push({ name: exportName, issues: [{ path: [label], code: 'INVALID_REFERENCE', message: `${id} does not exist in this workspace` }] });
    }
  }

  const overwriteIds = decisions.filter((d) => d.decision === 'overwrite' && d.existingId).map((d) => d.existingId as string);
  const existingCalculationIds = await findIds(overwriteIds, (ids) =>
    prisma.cocktailCalculation.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  );
  const groupIds = decisions.filter((d) => d.groupDecision === 'use-existing' && d.existingGroupId).map((d) => d.existingGroupId as string);
  const existingGroupIds = await findIds(groupIds, (ids) =>
    prisma.cocktailCalculationGroup.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  );

  const ingredientsByName = byLowerName(await prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true } }));
  const unitsByName = byLowerName(await prisma.unit.findMany({ where: { workspaceId }, select: { id: true, name: true } }));

  const seenOverwriteIds = new Set<string>();
  const plan: PlannedCalculation[] = [];

  decisions.forEach((decision, index) => {
    if (decision.decision === 'skip') return;
    const parsed = CalculationExportItemSchema.safeParse(decision.data);
    if (!parsed.success) {
      issues.push({ index, name: decision.exportName || exportItemName(decision.data), issues: parsed.error.issues });
      return;
    }
    const item = parsed.data;
    const itemIssues: Array<{ path: Array<string | number>; code: string; message: string }> = [];

    let overwriteId: string | null = null;
    if (decision.decision === 'overwrite') {
      if (!decision.existingId) {
        itemIssues.push({ path: ['existingId'], code: 'REQUIRED', message: 'existingId is required to overwrite' });
      } else if (!existingCalculationIds.has(decision.existingId)) {
        itemIssues.push({ path: ['existingId'], code: 'INVALID_REFERENCE', message: 'Calculation does not exist in this workspace' });
      } else if (seenOverwriteIds.has(decision.existingId)) {
        itemIssues.push({ path: ['existingId'], code: 'DUPLICATE', message: 'The same calculation is overwritten by more than one item' });
      } else {
        seenOverwriteIds.add(decision.existingId);
        overwriteId = decision.existingId;
      }
    }

    const group = groupPlanOf(decision, item);
    if (group.kind === 'existing' && !existingGroupIds.has(group.id)) {
      itemIssues.push({ path: ['existingGroupId'], code: 'INVALID_REFERENCE', message: 'Group does not exist in this workspace' });
    }

    // Cocktails are only imported when explicitly mapped (legacy behaviour).
    const items: PlannedCalculation['items'] = [];
    for (const ci of item.cocktailCalculationItems) {
      const cocktailId = cocktailMap.get(ci.cocktailName.toLowerCase());
      if (!cocktailId) continue;
      if (items.some((existing) => existing.cocktailId === cocktailId)) {
        itemIssues.push({ path: ['cocktailCalculationItems'], code: 'DUPLICATE', message: `Cocktail "${ci.cocktailName}" is mapped more than once` });
        continue;
      }
      items.push({ cocktailId, plannedAmount: ci.plannedAmount, customPrice: ci.customPrice ?? null });
    }

    // Ingredients: mapping, else exact name match, else skipped. Units: mapping, else name match, else created.
    const shoppingUnits: PlannedCalculation['shoppingUnits'] = [];
    const unitKeys = new Set<string>();
    for (const su of item.ingredientShoppingUnits) {
      const ingredientId = ingredientMap.get(su.ingredientName.toLowerCase()) ?? ingredientsByName.get(su.ingredientName.toLowerCase())?.id;
      if (!ingredientId) continue;
      const unitId = unitMap.get(su.unitName.toLowerCase()) ?? unitsByName.get(su.unitName.toLowerCase())?.id ?? null;
      const key = `${ingredientId}\u0000${unitId ?? `new:${su.unitName.toLowerCase()}`}`;
      if (unitKeys.has(key)) {
        itemIssues.push({
          path: ['ingredientShoppingUnits'],
          code: 'DUPLICATE',
          message: `Ingredient "${su.ingredientName}" with unit "${su.unitName}" appears more than once`,
        });
        continue;
      }
      unitKeys.add(key);
      shoppingUnits.push({ ingredientId, unitId, unitName: su.unitName, checked: su.checked ?? false });
    }

    if (itemIssues.length > 0) {
      issues.push({ index, name: item.calculation.name, issues: itemIssues });
      return;
    }

    plan.push({
      decision,
      name: decision.decision === 'rename' && decision.newName?.trim() ? decision.newName.trim() : item.calculation.name,
      overwriteId,
      group,
      showSalesStuff: item.calculation.showSalesStuff ?? false,
      items,
      shoppingUnits,
    });
  });

  if (issues.length > 0) throw invalidImport(issues);
  return plan;
}

async function executeImport(workspaceId: string, user: User, input: CalculationImportJsonInput) {
  const plan = await planImport(workspaceId, input);
  const planByDecision = new Map(plan.map((entry) => [entry.decision, entry]));

  return runTx(
    async (tx) => {
      // Groups and units may be created by name; serialize concurrent imports so
      // they reuse each other's rows instead of failing on the unique names.
      await lockWorkspaceScope(tx, workspaceId, 'calculation-import');
      const groupsByName = byLowerName(await tx.cocktailCalculationGroup.findMany({ where: { workspaceId }, select: { id: true, name: true } }));
      const unitsByName = byLowerName(await tx.unit.findMany({ where: { workspaceId }, select: { id: true, name: true } }));

      const results: Array<{ name: string; status: 'created' | 'overwritten' | 'skipped' }> = [];
      for (const decision of input.decisions ?? []) {
        const entry = planByDecision.get(decision);
        if (!entry) {
          results.push({ name: decision.exportName || exportItemName(decision.data), status: 'skipped' });
          continue;
        }

        let groupId: string | null = null;
        if (entry.group.kind === 'existing') {
          groupId = entry.group.id;
        } else if (entry.group.kind === 'by-name') {
          const existing = groupsByName.get(entry.group.name.toLowerCase());
          if (existing) {
            groupId = existing.id;
          } else {
            const createdGroup = await tx.cocktailCalculationGroup.create({
              data: { name: entry.group.name, workspaceId, isDefaultExpanded: entry.group.isDefaultExpanded },
            });
            groupsByName.set(createdGroup.name.toLowerCase(), createdGroup);
            groupId = createdGroup.id;
          }
        }

        const shoppingUnitRows: Array<{ ingredientId: string; unitId: string; checked: boolean }> = [];
        for (const su of entry.shoppingUnits) {
          let unitId = su.unitId ?? unitsByName.get(su.unitName.toLowerCase())?.id;
          if (!unitId) {
            const newUnit = await tx.unit.create({ data: { name: su.unitName, workspaceId } });
            unitsByName.set(newUnit.name.toLowerCase(), newUnit);
            unitId = newUnit.id;
          }
          shoppingUnitRows.push({ ingredientId: su.ingredientId, unitId, checked: su.checked });
        }

        const content = {
          name: entry.name,
          showSalesStuff: entry.showSalesStuff,
          updatedByUserId: user.id,
          groupId,
          cocktailCalculationItems: { createMany: { data: entry.items } },
          ingredientShoppingUnits: { createMany: { data: shoppingUnitRows } },
        };

        if (entry.overwriteId) {
          await lockCalculation(tx, workspaceId, entry.overwriteId);
          const oldCalculation = await tx.cocktailCalculation.findFirstOrThrow({ where: { id: entry.overwriteId, workspaceId }, include: logInclude });
          await tx.cocktailCalculationItems.deleteMany({ where: { calculationId: entry.overwriteId } });
          await tx.calculationIngredientShoppingUnit.deleteMany({ where: { cocktailCalculationId: entry.overwriteId } });
          const updated = await tx.cocktailCalculation.update({ where: { id: entry.overwriteId, workspaceId }, data: content, include: logInclude });
          await createLog(tx, workspaceId, user.id, 'CocktailCalculation', updated.id, 'UPDATE', oldCalculation, updated);
          results.push({ name: entry.name, status: 'overwritten' });
        } else {
          const created = await tx.cocktailCalculation.create({ data: { ...content, workspaceId }, include: logInclude });
          await createLog(tx, workspaceId, user.id, 'CocktailCalculation', created.id, 'CREATE', null, created);
          results.push({ name: entry.name, status: 'created' });
        }
      }
      return results;
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );
}

/**
 * Three-phase import (validate → prepare-mapping → execute) of a calculation
 * export dump. The response shape depends on the phase and is returned verbatim.
 * `execute` is all-or-nothing: everything is validated before the single write
 * transaction, and any failure inside it rolls back the whole import.
 */
export async function importCalculationsJson(workspace: Workspace, user: User, input: CalculationImportJsonInput): Promise<unknown> {
  if (input.phase === 'validate') {
    const entities = exportItemsOf(input.exportData).map((item) => {
      const parsed = CalculationExportItemSchema.safeParse(item);
      return parsed.success ? { name: parsed.data.calculation.name, valid: true } : { name: exportItemName(item), valid: false, issues: parsed.error.issues };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (input.phase === 'prepare-mapping') {
    return prepareImportMapping(workspace.id, exportItemsOf(input.exportData));
  }

  if (input.phase === 'execute') {
    assertRealUser(user);
    if (!input.decisions || input.decisions.length === 0) {
      throw new ApiError(400, 'NO_DECISIONS', 'No decisions provided');
    }
    const results = await executeImport(workspace.id, user, input);
    return { success: true, results };
  }

  throw new ApiError(400, 'INVALID_PHASE', 'Invalid phase');
}
