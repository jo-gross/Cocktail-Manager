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

function cleanUndefined(obj: Record<string, any>): void {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) delete obj[k];
  });
}

// ────────────── HELPER: strip base64 image data for export storage ──────────────

const IMAGE_KEYS = ['image', 'CocktailRecipeImage', 'GlassImage', 'GarnishImage', 'IngredientImage'];

function stripImages(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(stripImages);
  if (typeof data !== 'object') return data;

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (IMAGE_KEYS.includes(key)) continue;
    if (key === '_count') continue;
    result[key] = typeof value === 'object' && value !== null ? stripImages(value) : value;
  }
  return result;
}

// ────────────── SNAPSHOT BUILDERS ──────────────

function buildCocktailSnapshot(data: any): CocktailRecipeAuditSnapshot | null {
  if (!data) return null;

  const result: CocktailRecipeAuditSnapshot = {
    name: data.name,
    description: data.description ?? undefined,
    tags: data.tags?.length ? data.tags.reduce((acc: Record<string, true>, t: string) => ({ ...acc, [t]: true }), {}) : undefined,
    preparation: data.notes ?? undefined,
    history: data.history ?? undefined,
    price: data.price ?? undefined,
  };

  if (data.glass) {
    result.glass = data.glass.name;
  }
  if (data.ice) {
    result.ice = data.ice.name;
  }

  // Only store image as a presence flag
  const imageData = data.CocktailRecipeImage?.[0]?.image || data.image;
  if (imageData) {
    result.image = true;
  }

  if (data.steps && Array.isArray(data.steps)) {
    const stepsMap: Record<string, CocktailStepSnapshot> = {};

    data.steps.forEach((step: any) => {
      // Use database ID as stable key so reordering is detected as a position change
      const stepKey = step.id || `step-${step.stepNumber}`;
      const actionName = step.action?.name || 'Unknown';

      const ingredientsMap: Record<string, CocktailStepIngredientSnapshot> = {};
      if (step.ingredients && Array.isArray(step.ingredients)) {
        step.ingredients.forEach((ing: any) => {
          const ingName = ing.ingredient?.name || `Ingredient ${ing.ingredientNumber}`;
          const ingSnapshot: CocktailStepIngredientSnapshot = {
            amount: ing.amount ?? undefined,
            unit: ing.unit?.name ?? undefined,
            optional: ing.optional ? true : undefined,
            position: ing.ingredientNumber,
          };
          cleanUndefined(ingSnapshot as any);
          ingredientsMap[ingName] = ingSnapshot;
        });
      }

      const stepSnapshot: CocktailStepSnapshot = {
        action: actionName,
        position: step.stepNumber,
        optional: step.optional ? true : undefined,
        ingredients: Object.keys(ingredientsMap).length > 0 ? ingredientsMap : undefined,
      };
      // Only clean optional fields, keep action and position always
      Object.keys(stepSnapshot).forEach((k) => {
        if (k !== 'action' && k !== 'position') {
          if ((stepSnapshot as any)[k] === undefined) delete (stepSnapshot as any)[k];
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

    data.garnishes.forEach((garnish: any) => {
      const baseName = garnish.garnish?.name || `Garnish ${garnish.garnishNumber}`;
      garnishCounts[baseName] = (garnishCounts[baseName] || 0) + 1;
      const garnishKey = garnishCounts[baseName] > 1 ? `${baseName} (${garnishCounts[baseName]})` : baseName;

      const gSnapshot: CocktailGarnishSnapshot = {
        amount: (garnish as any).amount ?? undefined,
        unit: (garnish as any).unit?.name ?? undefined,
        optional: garnish.optional ? true : undefined,
        alternative: garnish.isAlternative ? true : undefined,
        note: garnish.description || undefined,
        position: garnish.garnishNumber,
      };
      cleanUndefined(gSnapshot as any);
      garnishesMap[garnishKey] = gSnapshot;
    });

    if (Object.keys(garnishesMap).length > 0) {
      result.garnishes = garnishesMap;
    }
  }

  return result;
}

function buildGlassSnapshot(data: any): GlassAuditSnapshot | null {
  if (!data) return null;

  const result: GlassAuditSnapshot = {
    name: data.name,
    notes: data.notes ?? undefined,
    volume: data.volume != null ? `${data.volume} ml` : undefined,
    deposit: data.deposit != null ? `${data.deposit} €` : undefined,
  };

  const imageData = data.GlassImage?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as any);
  return result;
}

function buildGarnishEntitySnapshot(data: any): GarnishAuditSnapshot | null {
  if (!data) return null;

  const result: GarnishAuditSnapshot = {
    name: data.name,
    description: data.description ?? undefined,
    notes: data.notes ?? undefined,
    price: data.price != null ? `${data.price} €` : undefined,
  };

  const imageData = data.GarnishImage?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as any);
  return result;
}

function buildIngredientSnapshot(data: any): IngredientAuditSnapshot | null {
  if (!data) return null;

  const result: IngredientAuditSnapshot = {
    name: data.name,
    shortName: data.shortName ?? undefined,
    description: data.description ?? undefined,
    notes: data.notes ?? undefined,
    price: data.price != null ? `${data.price} €` : undefined,
    link: data.link ?? undefined,
    tags: data.tags?.length ? data.tags.reduce((acc: Record<string, true>, t: string) => ({ ...acc, [t]: true }), {}) : undefined,
  };

  // Build units map: unit name -> volume
  const volumes = data.IngredientVolume || data.units;
  if (volumes && Array.isArray(volumes)) {
    const unitsMap: Record<string, string> = {};
    volumes.forEach((v: any) => {
      const unitName = v.unit?.name;
      if (unitName) {
        unitsMap[unitName] = v.volume != null ? String(v.volume) : '1';
      }
    });
    if (Object.keys(unitsMap).length > 0) {
      result.units = unitsMap;
    }
  }

  const imageData = data.IngredientImage?.[0]?.image ?? data.image;
  if (imageData) {
    result.image = true;
  }

  cleanUndefined(result as any);
  return result;
}

function buildCalculationSnapshot(data: any): CocktailCalculationAuditSnapshot | null {
  if (!data) return null;

  const result: CocktailCalculationAuditSnapshot = {
    name: data.name,
    showSalesInfo: data.showSalesStuff ? true : undefined,
  };

  const items = data.cocktailCalculationItems;
  if (items && Array.isArray(items) && items.length > 0) {
    const cocktailsMap: Record<string, CocktailCalculationItemSnapshot> = {};
    items.forEach((item: any) => {
      const cocktailName = item.cocktail?.name || item.cocktailId;
      const itemSnapshot: CocktailCalculationItemSnapshot = {
        plannedAmount: item.plannedAmount,
        customPrice: item.customPrice ?? undefined,
      };
      cleanUndefined(itemSnapshot as any);
      cocktailsMap[cocktailName] = itemSnapshot;
    });
    if (Object.keys(cocktailsMap).length > 0) {
      result.cocktails = cocktailsMap;
    }
  }

  const shoppingUnitsData = data.ingredientShoppingUnits;
  if (shoppingUnitsData && Array.isArray(shoppingUnitsData) && shoppingUnitsData.length > 0) {
    const unitsMap: Record<string, ShoppingUnitSnapshot> = {};
    shoppingUnitsData.forEach((su: any) => {
      const ingredientName = su.ingredient?.name || su.ingredientId;
      const snapshot: ShoppingUnitSnapshot = {
        unit: su.unit?.name || su.unitId,
        checked: su.checked ? true : undefined,
      };
      cleanUndefined(snapshot as any);
      unitsMap[ingredientName] = snapshot;
    });
    if (Object.keys(unitsMap).length > 0) {
      result.shoppingUnits = unitsMap;
    }
  }

  cleanUndefined(result as any);
  return result;
}

/**
 * Dispatches to the correct snapshot builder based on entity type.
 */
function buildSnapshot(entityType: string, data: any): any {
  switch (entityType) {
    case 'Glass':
      return buildGlassSnapshot(data);
    case 'Garnish':
      return buildGarnishEntitySnapshot(data);
    case 'Ingredient':
      return buildIngredientSnapshot(data);
    case 'CocktailCalculation':
      return buildCalculationSnapshot(data);
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
  oldData: any,
  newData: any,
) {
  const oldSnapshot = buildSnapshot(entityType, oldData);
  const newSnapshot = buildSnapshot(entityType, newData);

  let changes: any = undefined;
  let snapshot: any = undefined;
  let exportData: any = undefined;

  if (action === 'CREATE') {
    snapshot = newSnapshot;
    exportData = stripImages(newData);
  } else if (action === 'DELETE') {
    snapshot = oldSnapshot;
    exportData = stripImages(oldData);
  } else if (action === 'UPDATE') {
    const d = diff(oldSnapshot ?? {}, newSnapshot ?? {});
    if (!d || d.length === 0) return; // No changes detected, skip log entry
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
      changes: changes ? (changes as any) : undefined,
      snapshot: snapshot ? (snapshot as any) : undefined,
      exportData: exportData ? (exportData as any) : undefined,
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
  oldData: any,
  newData: any,
) {
  const oldSnapshot = buildCocktailSnapshot(oldData);
  const newSnapshot = buildCocktailSnapshot(newData);

  let changes: CocktailRecipeAuditDiff | undefined;
  let snapshot: CocktailRecipeAuditSnapshot | undefined;
  let exportData: any = undefined;

  if (action === 'CREATE') {
    snapshot = newSnapshot ?? undefined;
    exportData = stripImages(newData);
  } else if (action === 'DELETE') {
    snapshot = oldSnapshot ?? undefined;
    exportData = stripImages(oldData);
  } else if (action === 'UPDATE') {
    const d = diff(oldSnapshot ?? {}, newSnapshot ?? {}) as CocktailRecipeAuditDiff | undefined;
    if (!d || d.length === 0) return; // No changes detected, skip log entry
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
      changes: changes && changes.length > 0 ? (changes as any) : undefined,
      snapshot: snapshot ? (snapshot as any) : undefined,
      exportData: exportData ? (exportData as any) : undefined,
    },
  });
}
