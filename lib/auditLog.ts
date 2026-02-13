import { Prisma, PrismaClient } from '@generated/prisma/client';
import { diff, Diff } from 'deep-diff';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Type-safe snapshot model for cocktail recipes in the audit log.
 * Property names are German display labels used in the frontend UI.
 */
export interface CocktailStepIngredientSnapshot {
  Menge?: number;
  Einheit?: string;
  Optional?: 'Ja';
  Position: number;
}

export interface CocktailStepSnapshot {
  Aktion: string;
  Position: number;
  Optional?: 'Ja';
  Zutaten?: Record<string, CocktailStepIngredientSnapshot>; // Key = ingredient name
}

export interface CocktailGarnishSnapshot {
  Menge?: number;
  Einheit?: string;
  Optional?: 'Ja';
  Alternative?: 'Ja';
  Notiz?: string;
  Position: number;
}

export interface CocktailRecipeAuditSnapshot {
  Name: string;
  Beschreibung?: string | null;
  /** Tags stored as Record for content-based diffing (key = tag content) */
  Tags?: Record<string, true>;
  Zubereitung?: string | null;
  Geschichte?: string | null;
  Preis?: number | null;
  Glas?: string;
  Eis?: string;
  Bild?: 'Vorhanden';
  Schritte?: Record<string, CocktailStepSnapshot>; // Key = stable step key ("Schritt 1", "Schritt 2", ...)
  Garnituren?: Record<string, CocktailGarnishSnapshot>; // Key = garnish name ("Zeste", "Zeste (2)", ...)
}

export type CocktailRecipeAuditDiff = Diff<CocktailRecipeAuditSnapshot, CocktailRecipeAuditSnapshot>[];

/**
 * Creates an audit log entry within a Prisma transaction.
 *
 * @param tx - The Prisma transaction client.
 * @param workspaceId - The ID of the workspace.
 * @param userId - The ID of the user performing the action (optional for system actions).
 * @param entityType - The type of the entity (e.g., 'CocktailRecipe', 'Ingredient').
 * @param entityId - The ID of the entity.
 * @param action - The action performed ('CREATE', 'UPDATE', 'DELETE').
 * @param oldData - The previous state of the entity (for updates/deletes).
 * @param newData - The new state of the entity (for creates/updates).
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
  let changes: any = null;

  // Store the snapshot for CREATE and UPDATE
  if (action === 'CREATE' || action === 'UPDATE') {
    const snapshot = newData ? JSON.parse(JSON.stringify(newData)) : null;

    await tx.auditLog.create({
      data: {
        workspaceId,
        userId,
        entityType,
        entityId,
        action,
        changes: changes ?? undefined,
        snapshot: snapshot ?? undefined,
      },
    });
    return;
  }

  // DELETE: store old data as snapshot
  await tx.auditLog.create({
    data: {
      workspaceId,
      userId,
      entityType,
      entityId,
      action,
      changes: changes ?? undefined,
      snapshot: oldData ?? undefined,
    },
  });
}

/**
 * Builds a type-safe snapshot object from a full cocktail recipe entity
 * for use in the audit log (only for CocktailRecipe).
 */
function buildCocktailSnapshot(data: any): CocktailRecipeAuditSnapshot | null {
  if (!data) return null;

  const result: CocktailRecipeAuditSnapshot = {
    Name: data.name,
    Beschreibung: data.description ?? undefined,
    Tags: data.tags?.length ? data.tags.reduce((acc: Record<string, true>, t: string) => ({ ...acc, [t]: true }), {}) : undefined,
    Zubereitung: data.notes ?? undefined,
    Geschichte: data.history ?? undefined,
    Preis: data.price ?? undefined,
  };

  if (data.glass) {
    result.Glas = data.glass.name;
  }
  if (data.ice) {
    result.Eis = data.ice.name;
  }

  // Only store image as a flag
  const image = data.CocktailRecipeImage?.[0]?.image || data.image;
  if (image) {
    result.Bild = 'Vorhanden';
  }

  if (data.steps && Array.isArray(data.steps)) {
    const steps: Record<string, CocktailStepSnapshot> = {};

    data.steps.forEach((step: any) => {
      // Use database ID as stable key so reordering is detected as a Position change
      const stepKey = step.id || `step-${step.stepNumber}`;
      const actionName = step.action?.name || `Unbekannt`;

      const ingredients: Record<string, CocktailStepIngredientSnapshot> = {};
      if (step.ingredients && Array.isArray(step.ingredients)) {
        step.ingredients.forEach((ing: any) => {
          const ingName = ing.ingredient?.name || `Zutat ${ing.ingredientNumber}`;
          const ingSnapshot: CocktailStepIngredientSnapshot = {
            Menge: ing.amount ?? undefined,
            Einheit: ing.unit?.name ?? undefined,
            Optional: ing.optional ? 'Ja' : undefined,
            Position: ing.ingredientNumber,
          };
          Object.keys(ingSnapshot).forEach((k) => (ingSnapshot as any)[k] === undefined && delete (ingSnapshot as any)[k]);
          ingredients[ingName] = ingSnapshot;
        });
      }

      const stepSnapshot: CocktailStepSnapshot = {
        Aktion: actionName,
        Position: step.stepNumber,
        Optional: step.optional ? 'Ja' : undefined,
        Zutaten: Object.keys(ingredients).length > 0 ? ingredients : undefined,
      };
      Object.keys(stepSnapshot).forEach((k) => {
        if (k !== 'Aktion' && k !== 'Position') {
          if ((stepSnapshot as any)[k] === undefined) delete (stepSnapshot as any)[k];
        }
      });

      steps[stepKey] = stepSnapshot;
    });

    if (Object.keys(steps).length > 0) {
      result.Schritte = steps;
    }
  }

  if (data.garnishes && Array.isArray(data.garnishes)) {
    const garnishes: Record<string, CocktailGarnishSnapshot> = {};
    const garnishCounts: { [key: string]: number } = {};

    data.garnishes.forEach((garnish: any) => {
      const baseName = garnish.garnish?.name || `Garnitur ${garnish.garnishNumber}`;
      garnishCounts[baseName] = (garnishCounts[baseName] || 0) + 1;
      const garnishKey = garnishCounts[baseName] > 1 ? `${baseName} (${garnishCounts[baseName]})` : baseName;

      const gSnapshot: CocktailGarnishSnapshot = {
        Menge: (garnish as any).amount ?? undefined,
        Einheit: (garnish as any).unit?.name ?? undefined,
        Optional: garnish.optional ? 'Ja' : undefined,
        Alternative: garnish.isAlternative ? 'Ja' : undefined,
        Notiz: garnish.description || undefined,
        Position: garnish.garnishNumber,
      };
      Object.keys(gSnapshot).forEach((k) => (gSnapshot as any)[k] === undefined && delete (gSnapshot as any)[k]);
      garnishes[garnishKey] = gSnapshot;
    });

    if (Object.keys(garnishes).length > 0) {
      result.Garnituren = garnishes;
    }
  }

  return result;
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

  if (action === 'CREATE') {
    snapshot = newSnapshot ?? undefined;
  } else if (action === 'DELETE') {
    snapshot = oldSnapshot ?? undefined;
  } else if (action === 'UPDATE') {
    snapshot = newSnapshot ?? undefined;
    const d = diff(oldSnapshot ?? {}, newSnapshot ?? {}) as CocktailRecipeAuditDiff | undefined;
    if (d && d.length > 0) {
      changes = d;
    }
  }

  await tx.auditLog.create({
    data: {
      workspaceId,
      userId,
      entityType: 'CocktailRecipe',
      entityId,
      action,
      // Cast to any for Prisma JSON field compatibility
      changes: changes && changes.length > 0 ? (changes as any) : undefined,
      snapshot: snapshot ? (snapshot as any) : undefined,
    },
  });
}

function transformDataForLog(entityType: string, data: any): any {
  if (!data) return null;

  if (entityType === 'CocktailRecipe') {
    const result: any = {
      Name: data.name,
      Beschreibung: data.description,
      Tags: data.tags,
      Zubereitung: data.notes,
      Geschichte: data.history,
      Preis: data.price,
    };

    if (data.glass) {
      result['Glas'] = data.glass.name;
    }
    if (data.ice) {
      result['Eis'] = data.ice.name;
    }

    // Image tracking - store presence flag, not the actual data
    const image = data.CocktailRecipeImage?.[0]?.image || data.image;
    if (image) {
      result['Bild'] = 'Vorhanden';
    }

    if (data.steps && Array.isArray(data.steps)) {
      const steps: any = {};
      const actionCounts: { [key: string]: number } = {};

      data.steps.forEach((step: any) => {
        const baseActionName = step.action?.name || `Schritt ${step.stepNumber}`;
        actionCounts[baseActionName] = (actionCounts[baseActionName] || 0) + 1;
        const stepKey = actionCounts[baseActionName] > 1 ? `${baseActionName} (${actionCounts[baseActionName]})` : baseActionName;

        const ingredients: any = {};
        if (step.ingredients && Array.isArray(step.ingredients)) {
          step.ingredients.forEach((ing: any) => {
            const ingName = ing.ingredient?.name || `Zutat ${ing.ingredientNumber}`;
            ingredients[ingName] = {
              Menge: ing.amount,
              Einheit: ing.unit?.name,
              Optional: ing.optional ? 'Ja' : undefined,
              Position: ing.ingredientNumber,
            };
            Object.keys(ingredients[ingName]).forEach((key) => ingredients[ingName][key] === undefined && delete ingredients[ingName][key]);
          });
        }

        steps[stepKey] = {
          Position: step.stepNumber,
          Optional: step.optional ? 'Ja' : undefined,
          Zutaten: Object.keys(ingredients).length > 0 ? ingredients : undefined,
        };
        Object.keys(steps[stepKey]).forEach((key) => steps[stepKey][key] === undefined && delete steps[stepKey][key]);
      });
      if (Object.keys(steps).length > 0) {
        result['Schritte'] = steps;
      }
    }

    if (data.garnishes && Array.isArray(data.garnishes)) {
      const garnishes: any = {};
      const garnishCounts: { [key: string]: number } = {};

      data.garnishes.forEach((garnish: any) => {
        const baseName = garnish.garnish?.name || `Garnitur ${garnish.garnishNumber}`;
        garnishCounts[baseName] = (garnishCounts[baseName] || 0) + 1;
        const garnishKey = garnishCounts[baseName] > 1 ? `${baseName} (${garnishCounts[baseName]})` : baseName;

        garnishes[garnishKey] = {
          Menge: garnish.amount,
          Einheit: garnish.unit?.name,
          Optional: garnish.optional ? 'Ja' : undefined,
          Alternative: garnish.isAlternative ? 'Ja' : undefined,
          Notiz: garnish.description || undefined,
          Position: garnish.garnishNumber,
        };
        Object.keys(garnishes[garnishKey]).forEach((k) => garnishes[garnishKey][k] === undefined && delete garnishes[garnishKey][k]);
      });
      if (Object.keys(garnishes).length > 0) {
        result['Garnituren'] = garnishes;
      }
    }

    return result;
  }

  if (entityType === 'Ingredient') {
    const result: any = {
      Name: data.name,
      Beschreibung: data.description,
      Notizen: data.notes,
      Preis: data.price,
      Tags: data.tags,
      Kurzname: data.shortName,
      Link: data.link,
      Alkoholgehalt: data.alcoholContent,
    };
    // Remove undefined fields
    Object.keys(result).forEach((key) => result[key] === undefined && delete result[key]);
    if (result.Preis) result.Preis = `${result.Preis} €`;
    if (result.Alkoholgehalt) result.Alkoholgehalt = `${result.Alkoholgehalt} %`;

    if (data.units && Array.isArray(data.units)) {
      const units: any = {};
      data.units.forEach((u: any) => {
        if (u.unit?.name) {
          units[u.unit.name] = u.volume || '1';
        }
      });
      if (Object.keys(units).length > 0) {
        result['Einheiten'] = units;
      }
    }

    return result;
  }

  // Default fallback: shallow copy without internal fields
  const copy = { ...data };
  delete copy.id;
  delete copy.workspaceId;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.deletedAt;

  return copy;
}
