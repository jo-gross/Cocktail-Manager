import { Prisma } from '@generated/prisma/client';
import { diff, Diff } from 'deep-diff';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

// ────────────── COCKTAIL RECIPE SNAPSHOTS ──────────────

export interface CocktailStepIngredientSnapshot {
  amount?: number;
  unit?: string;
  optional?: true;
  position: number;
}

export interface CocktailStepSnapshot {
  action: string;
  position: number;
  optional?: true;
  ingredients?: Record<string, CocktailStepIngredientSnapshot>; // Key = ingredient name
}

export interface CocktailGarnishSnapshot {
  amount?: number;
  unit?: string;
  optional?: true;
  alternative?: true;
  note?: string;
  position: number;
}

export interface CocktailRecipeAuditSnapshot {
  name: string;
  description?: string | null;
  /** Tags stored as Record for content-based diffing (key = tag content) */
  tags?: Record<string, true>;
  preparation?: string | null;
  history?: string | null;
  price?: number | null;
  glass?: string;
  ice?: string;
  image?: true;
  steps?: Record<string, CocktailStepSnapshot>;
  garnishes?: Record<string, CocktailGarnishSnapshot>;
}

export type CocktailRecipeAuditDiff = Diff<CocktailRecipeAuditSnapshot, CocktailRecipeAuditSnapshot>[];

// ────────────── GLASS SNAPSHOT ──────────────

export interface GlassAuditSnapshot {
  name: string;
  notes?: string;
  volume?: string;
  deposit?: string;
  image?: true;
}

// ────────────── GARNISH SNAPSHOT ──────────────

export interface GarnishAuditSnapshot {
  name: string;
  description?: string;
  notes?: string;
  price?: string;
  image?: true;
}

// ────────────── INGREDIENT SNAPSHOT ──────────────

export interface IngredientAuditSnapshot {
  name: string;
  shortName?: string;
  description?: string;
  notes?: string;
  price?: string;
  link?: string;
  tags?: Record<string, true>;
  units?: Record<string, string>; // unit name -> volume
  image?: true;
}

// ────────────── COCKTAIL CALCULATION SNAPSHOT ──────────────

export interface CocktailCalculationItemSnapshot {
  plannedAmount: number;
  customPrice?: number;
}

export interface ShoppingUnitSnapshot {
  unit: string;
  checked?: true;
}

export interface CocktailCalculationAuditSnapshot {
  name: string;
  showSalesInfo?: true;
  cocktails?: Record<string, CocktailCalculationItemSnapshot>;
  shoppingUnits?: Record<string, ShoppingUnitSnapshot>; // Key = ingredient name
}

// ────────────── HELPER: remove undefined keys ──────────────

function cleanUndefined(obj: Record<string, unknown>): void {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) delete obj[k];
  });
}

// ────────────── HELPER: strip base64 image data for export storage ──────────────

const IMAGE_KEYS = ['image', 'CocktailRecipeImage', 'GlassImage', 'GarnishImage', 'IngredientImage'];

function stripImages(data: unknown): unknown {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(stripImages);
  if (typeof data !== 'object') return data;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (IMAGE_KEYS.includes(key)) continue;
    if (key === '_count') continue;
    result[key] = typeof value === 'object' && value !== null ? stripImages(value) : value;
  }
  return result;
}

// ────────────── SNAPSHOT BUILDERS ──────────────

function buildCocktailSnapshot(data: Record<string, unknown> | null): CocktailRecipeAuditSnapshot | null {
  if (!data) return null;

  const tags = data.tags as string[] | undefined;
  const result: CocktailRecipeAuditSnapshot = {
    name: data.name as string,
    description: (data.description as string) ?? undefined,
    tags: tags?.length
      ? tags.reduce<Record<string, true>>((acc, t) => {
          acc[t] = true;
          return acc;
        }, {})
      : undefined,
    preparation: (data.notes as string) ?? undefined,
    history: (data.history as string) ?? undefined,
    price: (data.price as number) ?? undefined,
  };

  const glass = data.glass as Record<string, unknown> | undefined;
  if (glass) {
    result.glass = glass.name as string;
  }
  const ice = data.ice as Record<string, unknown> | undefined;
  if (ice) {
    result.ice = ice.name as string;
  }

  // Only store image as a presence flag
  const cocktailImages = data.CocktailRecipeImage as Array<Record<string, unknown>> | undefined;
  const imageData = cocktailImages?.[0]?.image || data.image;
  if (imageData) {
    result.image = true;
  }

  if (data.steps && Array.isArray(data.steps)) {
    const stepsMap: Record<string, CocktailStepSnapshot> = {};

    (data.steps as Record<string, unknown>[]).forEach((step) => {
      const stepAction = step.action as Record<string, unknown> | undefined;
      const stepKey = (step.id as string) || `step-${step.stepNumber}`;
      const actionName = (stepAction?.name as string) || 'Unknown';

      const ingredientsMap: Record<string, CocktailStepIngredientSnapshot> = {};
      if (step.ingredients && Array.isArray(step.ingredients)) {
        (step.ingredients as Record<string, unknown>[]).forEach((ing) => {
          const ingIngredient = ing.ingredient as Record<string, unknown> | undefined;
          const ingUnit = ing.unit as Record<string, unknown> | undefined;
          const ingName = (ingIngredient?.name as string) || `Ingredient ${ing.ingredientNumber}`;
          const ingSnapshot: CocktailStepIngredientSnapshot = {
            amount: (ing.amount as number) ?? undefined,
            unit: (ingUnit?.name as string) ?? undefined,
            optional: ing.optional ? true : undefined,
            position: ing.ingredientNumber as number,
          };
          cleanUndefined(ingSnapshot as unknown as Record<string, unknown>);
          ingredientsMap[ingName] = ingSnapshot;
        });
      }

      const stepSnapshot: CocktailStepSnapshot = {
        action: actionName,
        position: step.stepNumber as number,
        optional: step.optional ? true : undefined,
        ingredients: Object.keys(ingredientsMap).length > 0 ? ingredientsMap : undefined,
      };
      const snapshotRecord = stepSnapshot as unknown as Record<string, unknown>;
      Object.keys(snapshotRecord).forEach((k) => {
        if (k !== 'action' && k !== 'position') {
          if (snapshotRecord[k] === undefined) delete snapshotRecord[k];
        }
      });

      stepsMap[stepKey] = stepSnapshot;
    });

    if (Object.keys(stepsMap).length > 0) {
      result.steps = stepsMap;
    }
  }

  if (data.garnishes && Array.isArray(data.garnishes)) {
    const garnishesMap: Record<string, CocktailGarnishSnapshot> = {};
    const garnishCounts: Record<string, number> = {};

    (data.garnishes as Record<string, unknown>[]).forEach((garnish) => {
      const garnishEntity = garnish.garnish as Record<string, unknown> | undefined;
      const garnishUnit = garnish.unit as Record<string, unknown> | undefined;
      const baseName = (garnishEntity?.name as string) || `Garnish ${garnish.garnishNumber}`;
      garnishCounts[baseName] = (garnishCounts[baseName] || 0) + 1;
      const garnishKey = garnishCounts[baseName] > 1 ? `${baseName} (${garnishCounts[baseName]})` : baseName;

      const gSnapshot: CocktailGarnishSnapshot = {
        amount: (garnish.amount as number) ?? undefined,
        unit: (garnishUnit?.name as string) ?? undefined,
        optional: garnish.optional ? true : undefined,
        alternative: garnish.isAlternative ? true : undefined,
        note: (garnish.description as string) || undefined,
        position: garnish.garnishNumber as number,
      };
      cleanUndefined(gSnapshot as unknown as Record<string, unknown>);
      garnishesMap[garnishKey] = gSnapshot;
    });

    if (Object.keys(garnishesMap).length > 0) {
      result.garnishes = garnishesMap;
    }
  }

  return result;
}

function buildGlassSnapshot(data: Record<string, unknown> | null): GlassAuditSnapshot | null {
  if (!data) return null;

  const result: GlassAuditSnapshot = {
    name: data.name as string,
    notes: (data.notes as string) ?? undefined,
    volume: data.volume != null ? `${data.volume} ml` : undefined,
    deposit: data.deposit != null ? `${data.deposit} €` : undefined,
  };

  const glassImages = data.GlassImage as Array<Record<string, unknown>> | undefined;
  const imageData = glassImages?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as unknown as Record<string, unknown>);
  return result;
}

function buildGarnishEntitySnapshot(data: Record<string, unknown> | null): GarnishAuditSnapshot | null {
  if (!data) return null;

  const result: GarnishAuditSnapshot = {
    name: data.name as string,
    description: (data.description as string) ?? undefined,
    notes: (data.notes as string) ?? undefined,
    price: data.price != null ? `${data.price} €` : undefined,
  };

  const garnishImages = data.GarnishImage as Array<Record<string, unknown>> | undefined;
  const imageData = garnishImages?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as unknown as Record<string, unknown>);
  return result;
}

function buildIngredientSnapshot(data: Record<string, unknown> | null): IngredientAuditSnapshot | null {
  if (!data) return null;

  const tags = data.tags as string[] | undefined;
  const result: IngredientAuditSnapshot = {
    name: data.name as string,
    shortName: (data.shortName as string) ?? undefined,
    description: (data.description as string) ?? undefined,
    notes: (data.notes as string) ?? undefined,
    price: data.price != null ? `${data.price} €` : undefined,
    link: (data.link as string) ?? undefined,
    tags: tags?.length
      ? tags.reduce<Record<string, true>>((acc, t) => {
          acc[t] = true;
          return acc;
        }, {})
      : undefined,
  };

  const volumes = (data.IngredientVolume || data.units) as Array<Record<string, unknown>> | undefined;
  if (volumes && Array.isArray(volumes)) {
    const unitsMap: Record<string, string> = {};
    volumes.forEach((v) => {
      const vUnit = v.unit as Record<string, unknown> | undefined;
      const unitName = vUnit?.name as string | undefined;
      if (unitName) {
        unitsMap[unitName] = v.volume != null ? String(v.volume) : '1';
      }
    });
    if (Object.keys(unitsMap).length > 0) {
      result.units = unitsMap;
    }
  }

  const ingredientImages = data.IngredientImage as Array<Record<string, unknown>> | undefined;
  const imageData = ingredientImages?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as unknown as Record<string, unknown>);
  return result;
}

function buildCalculationSnapshot(data: Record<string, unknown> | null): CocktailCalculationAuditSnapshot | null {
  if (!data) return null;

  const result: CocktailCalculationAuditSnapshot = {
    name: data.name as string,
    showSalesInfo: data.showSalesStuff ? true : undefined,
  };

  const items = data.cocktailCalculationItems as Array<Record<string, unknown>> | undefined;
  if (items && Array.isArray(items) && items.length > 0) {
    const cocktailsMap: Record<string, CocktailCalculationItemSnapshot> = {};
    items.forEach((item) => {
      const itemCocktail = item.cocktail as Record<string, unknown> | undefined;
      const cocktailName = (itemCocktail?.name as string) || (item.cocktailId as string);
      const itemSnapshot: CocktailCalculationItemSnapshot = {
        plannedAmount: item.plannedAmount as number,
        customPrice: (item.customPrice as number) ?? undefined,
      };
      cleanUndefined(itemSnapshot as unknown as Record<string, unknown>);
      cocktailsMap[cocktailName] = itemSnapshot;
    });
    if (Object.keys(cocktailsMap).length > 0) {
      result.cocktails = cocktailsMap;
    }
  }

  const shoppingUnitsData = data.ingredientShoppingUnits as Array<Record<string, unknown>> | undefined;
  if (shoppingUnitsData && Array.isArray(shoppingUnitsData) && shoppingUnitsData.length > 0) {
    const unitsMap: Record<string, ShoppingUnitSnapshot> = {};
    shoppingUnitsData.forEach((su) => {
      const suIngredient = su.ingredient as Record<string, unknown> | undefined;
      const suUnit = su.unit as Record<string, unknown> | undefined;
      const ingredientName = (suIngredient?.name as string) || (su.ingredientId as string);
      const snapshot: ShoppingUnitSnapshot = {
        unit: (suUnit?.name as string) || (su.unitId as string),
        checked: su.checked ? true : undefined,
      };
      cleanUndefined(snapshot as unknown as Record<string, unknown>);
      unitsMap[ingredientName] = snapshot;
    });
    if (Object.keys(unitsMap).length > 0) {
      result.shoppingUnits = unitsMap;
    }
  }

  cleanUndefined(result as unknown as Record<string, unknown>);
  return result;
}

/**
 * Dispatches to the correct snapshot builder based on entity type.
 */
function buildSnapshot(entityType: string, data: Record<string, unknown> | null): Record<string, unknown> | null {
  switch (entityType) {
    case 'Glass':
      return buildGlassSnapshot(data) as unknown as Record<string, unknown> | null;
    case 'Garnish':
      return buildGarnishEntitySnapshot(data) as unknown as Record<string, unknown> | null;
    case 'Ingredient':
      return buildIngredientSnapshot(data) as unknown as Record<string, unknown> | null;
    case 'CocktailCalculation':
      return buildCalculationSnapshot(data) as unknown as Record<string, unknown> | null;
    default:
      return data ? JSON.parse(JSON.stringify(data)) : null;
  }
}

// ────────────── AUDIT LOG CREATION ──────────────

/**
 * Creates an audit log entry within a Prisma transaction.
 * Builds a typed snapshot and computes a deep-diff for updates.
 */
export async function createLog(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string | undefined,
  entityType: string,
  entityId: string,
  action: AuditAction,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
) {
  const oldSnapshot = buildSnapshot(entityType, oldData);
  const newSnapshot = buildSnapshot(entityType, newData);

  let changes: Diff<Record<string, unknown>, Record<string, unknown>>[] | undefined = undefined;
  let snapshot: Record<string, unknown> | null | undefined = undefined;
  let exportData: unknown = undefined;

  if (action === 'CREATE') {
    snapshot = newSnapshot;
    exportData = stripImages(newData);
  } else if (action === 'DELETE') {
    snapshot = oldSnapshot;
    exportData = stripImages(oldData);
  } else if (action === 'UPDATE') {
    const d = diff(oldSnapshot ?? {}, newSnapshot ?? {});
    if (!d || d.length === 0) return;
    snapshot = newSnapshot;
    changes = d;
    exportData = stripImages(newData);
  }

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId,
      entityType,
      entityId,
      action,
      changes: changes ? (changes as unknown as Prisma.InputJsonValue) : undefined,
      snapshot: snapshot ? (snapshot as Prisma.InputJsonValue) : undefined,
      exportData: exportData ? (exportData as Prisma.InputJsonValue) : undefined,
    },
  });
}

/**
 * Specialized audit log function for cocktail recipes.
 * Uses a type-safe snapshot model and stores a deep-diff for updates.
 */
export async function createCocktailRecipeAuditLog(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  userId: string | undefined,
  entityId: string,
  action: AuditAction,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
) {
  const oldSnapshot = buildCocktailSnapshot(oldData);
  const newSnapshot = buildCocktailSnapshot(newData);

  let changes: CocktailRecipeAuditDiff | undefined;
  let snapshot: CocktailRecipeAuditSnapshot | undefined;
  let exportData: unknown = undefined;

  if (action === 'CREATE') {
    snapshot = newSnapshot ?? undefined;
    exportData = stripImages(newData);
  } else if (action === 'DELETE') {
    snapshot = oldSnapshot ?? undefined;
    exportData = stripImages(oldData);
  } else if (action === 'UPDATE') {
    const d = diff(oldSnapshot ?? {}, newSnapshot ?? {}) as CocktailRecipeAuditDiff | undefined;
    if (!d || d.length === 0) return;
    snapshot = newSnapshot ?? undefined;
    changes = d;
    exportData = stripImages(newData);
  }

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId,
      entityType: 'CocktailRecipe',
      entityId,
      action,
      changes: changes && changes.length > 0 ? (changes as unknown as Prisma.InputJsonValue) : undefined,
      snapshot: snapshot ? (snapshot as unknown as Prisma.InputJsonValue) : undefined,
      exportData: exportData ? (exportData as Prisma.InputJsonValue) : undefined,
    },
  });
}
