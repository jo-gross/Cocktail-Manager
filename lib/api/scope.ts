/**
 * Workspace scoping (tenant isolation) helpers.
 *
 * Every id that reaches a query — from the path OR the request body — must be
 * proven to belong to the caller's workspace before it is read, connected,
 * updated or deleted. `findUnique({ where: { id } })` alone is never enough.
 */
import { ApiError } from '@lib/http/ApiError';
import type { Db } from '@lib/db/tx';

type IdRows = Promise<Array<{ id: string }>>;

const finders = {
  glass: (db: Db, ids: string[], workspaceId: string): IdRows => db.glass.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  garnish: (db: Db, ids: string[], workspaceId: string): IdRows => db.garnish.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  ingredient: (db: Db, ids: string[], workspaceId: string): IdRows => db.ingredient.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  cocktail: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.cocktailRecipe.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  card: (db: Db, ids: string[], workspaceId: string): IdRows => db.cocktailCard.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  calculation: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.cocktailCalculation.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  calculationGroup: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.cocktailCalculationGroup.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  unit: (db: Db, ids: string[], workspaceId: string): IdRows => db.unit.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  ice: (db: Db, ids: string[], workspaceId: string): IdRows => db.ice.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  action: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.workspaceCocktailRecipeStepAction.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  guestMenu: (db: Db, ids: string[], workspaceId: string): IdRows => db.guestMenu.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  tagCategory: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.tagCategory.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
  signageSlide: (db: Db, ids: string[], workspaceId: string): IdRows =>
    db.signageSlide.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true } }),
} as const;

export type ScopedEntity = keyof typeof finders;

const LABELS: Record<ScopedEntity, string> = {
  glass: 'Glass',
  garnish: 'Garnish',
  ingredient: 'Ingredient',
  cocktail: 'Cocktail',
  card: 'Card',
  calculation: 'Calculation',
  calculationGroup: 'Calculation group',
  unit: 'Unit',
  ice: 'Ice',
  action: 'Action',
  guestMenu: 'Guest menu',
  tagCategory: 'Tag category',
  signageSlide: 'Signage slide',
};

export type IdRefs = Partial<Record<ScopedEntity, Iterable<string | null | undefined>>>;

function uniqueIds(values: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) if (typeof value === 'string' && value.length > 0) set.add(value);
  return [...set];
}

/**
 * Throws 404 NOT_FOUND unless the entity exists in the workspace. Use for the
 * path id of the resource being read/changed.
 */
export async function assertInWorkspace(db: Db, entity: ScopedEntity, id: string, workspaceId: string, message?: string): Promise<void> {
  const rows = await finders[entity](db, [id], workspaceId);
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', message ?? `${LABELS[entity]} not found`);
}

/**
 * Throws 400 INVALID_REFERENCE when any referenced id (from a request body)
 * does not belong to the workspace. `null`/`undefined` entries are ignored.
 */
export async function assertIdsInWorkspace(db: Db, workspaceId: string, refs: IdRefs): Promise<void> {
  const missing: Array<{ entity: ScopedEntity; ids: string[] }> = [];
  for (const [entity, values] of Object.entries(refs) as Array<[ScopedEntity, Iterable<string | null | undefined>]>) {
    const ids = uniqueIds(values);
    if (ids.length === 0) continue;
    const found = new Set((await finders[entity](db, ids, workspaceId)).map((row) => row.id));
    const notFound = ids.filter((id) => !found.has(id));
    if (notFound.length > 0) missing.push({ entity, ids: notFound });
  }
  if (missing.length > 0) {
    const names = missing.map((entry) => LABELS[entry.entity]).join(', ');
    throw new ApiError(400, 'INVALID_REFERENCE', `Referenced records do not exist in this workspace: ${names}`, missing);
  }
}
