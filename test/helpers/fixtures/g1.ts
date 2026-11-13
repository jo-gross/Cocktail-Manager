/**
 * Fixtures for the glasses / garnishes / ingredients integration tests.
 */
import { randomBytes } from 'node:crypto';
import prisma from '../../../prisma/prisma';
import type { Prisma } from '@generated/prisma/client';

/** Smallest valid PNG (1×1, transparent) as a data URI. */
export const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Script-capable image type that must never be accepted. */
export const SVG_DATA_URI = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;

function suffix(): string {
  return randomBytes(3).toString('hex');
}

export async function seedGlassWithImage(workspaceId: string, name = `Glass ${suffix()}`) {
  return prisma.glass.create({ data: { name, deposit: 2, volume: 30, workspaceId, GlassImage: { create: { image: PNG_DATA_URI } } } });
}

export async function seedGarnish(workspaceId: string, name = `Garnish ${suffix()}`, withImage = false) {
  return prisma.garnish.create({
    data: { name, price: 1, workspaceId, ...(withImage ? { GarnishImage: { create: { image: PNG_DATA_URI } } } : {}) },
  });
}

export async function seedUnit(workspaceId: string, name = `Unit ${suffix()}`) {
  return prisma.unit.create({ data: { name, workspaceId } });
}

/** Ingredient with an image and one volume in `unitId`. */
export async function seedIngredientWithVolume(workspaceId: string, unitId: string, name = `Ingredient ${suffix()}`) {
  return prisma.ingredient.create({
    data: {
      name,
      workspaceId,
      IngredientImage: { create: { image: PNG_DATA_URI } },
      IngredientVolume: { create: { volume: 70, unitId, workspaceId } },
    },
  });
}

/** Cocktail with one (empty) recipe step, for attaching recipe lines. */
export async function seedCocktailWithStep(workspaceId: string, glassId?: string) {
  const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: `Shake ${suffix()}`, actionGroup: 'MIXING', workspaceId } });
  return prisma.cocktailRecipe.create({
    data: { name: `Cocktail ${suffix()}`, workspaceId, glassId, steps: { create: { stepNumber: 0, actionId: action.id } } },
    include: { steps: true },
  });
}

/**
 * Runs `write` in a transaction that stays open until `commit()` is called, so a
 * test can fire a competing request while the write is uncommitted.
 */
export async function openTransaction(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  let commit!: () => void;
  const gate = new Promise<void>((resolve) => (commit = resolve));
  let written!: () => void;
  const ready = new Promise<void>((resolve) => (written = resolve));
  const done = prisma.$transaction(
    async (tx) => {
      await write(tx);
      written();
      await gate;
    },
    { timeout: 20_000 },
  );
  await ready;
  return { commit, done };
}

export function glassExportItem(name: string, overrides: Record<string, unknown> = {}) {
  return {
    exportVersion: '1.0.0',
    exportDate: new Date().toISOString(),
    glass: { id: 'exported-id', name, notes: null, volume: 25, deposit: 1.5, workspaceId: 'other-ws', ...overrides },
  };
}

export function garnishExportItem(name: string, overrides: Record<string, unknown> = {}) {
  return {
    exportVersion: '1.0.0',
    exportDate: new Date().toISOString(),
    garnish: {
      id: 'exported-id',
      name,
      description: 'desc',
      notes: null,
      price: 0.5,
      allergens: ['CELERY', 'NOT_A_CODE'],
      workspaceId: 'other-ws',
      ...overrides,
    },
  };
}

export function ingredientExportItem(name: string, units: Array<{ name: string; volume: number }> = [], overrides: Record<string, unknown> = {}) {
  return {
    exportVersion: '1.0.0',
    exportDate: new Date().toISOString(),
    ingredient: { id: 'exported-id', name, shortName: null, price: 20, tags: ['rum'], abv: 40, workspaceId: 'other-ws', ...overrides },
    ingredientVolumes: units.map((unit, index) => ({
      id: `vol-${index}`,
      volume: unit.volume,
      ingredientId: 'exported-id',
      unitId: `unit-${index}`,
      workspaceId: 'other-ws',
    })),
    units: units.map((unit, index) => ({ id: `unit-${index}`, name: unit.name, workspaceId: 'other-ws' })),
  };
}

/** `execute` decision as sent by EntityImportModal. */
export function decision(data: { glass?: { name: string }; garnish?: { name: string }; ingredient?: { name: string } }, extra: Record<string, unknown> = {}) {
  const exportName = (data.glass ?? data.garnish ?? data.ingredient)?.name ?? 'Unbekannt';
  return { exportName, decision: 'import', data, ...extra };
}
