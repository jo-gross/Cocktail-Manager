/**
 * Version-agnostic business logic for content translations (v1): reads and
 * writes the CocktailRecipe/Ingredient/Garnish/Glass translation tables. The
 * entities themselves hold the primary-language values (`source`).
 */
import prisma from '../../../prisma/prisma';
import type { Workspace } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { BULK_TX_TIMEOUT_MS, runTx, type Tx } from '@lib/db/tx';
import { loadWorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings.server';
import {
  CONTENT_TRANSLATION_ENTITY_TYPES,
  CONTENT_TRANSLATION_FIELDS,
  type AnyContentTranslationField,
  type ContentTranslationEntityType,
} from '@lib/translations/contentTranslationFields';
import type {
  ContentTranslationRow,
  ContentTranslationsDto,
  ContentTranslationsQuery,
  ContentTranslationsUpdateInput,
  ContentTranslationsUpdateResult,
} from '@lib/schemas/contentTranslations';

type FieldValues = Partial<Record<AnyContentTranslationField, string | null>>;

interface TranslationGroup {
  entityType: ContentTranslationEntityType;
  entityId: string;
  locale: string;
  data: FieldValues;
  count: number;
}

interface TranslatableEntity {
  id: string;
  name: string;
  source: FieldValues;
  translations: (FieldValues & { locale: string })[];
}

async function loadEntities(
  workspaceId: string,
  entityType: ContentTranslationEntityType,
  locales: string[],
  entityId: string | undefined,
): Promise<TranslatableEntity[]> {
  const where = { workspaceId, ...(entityId ? { id: entityId } : {}) };
  const translations = { where: { locale: { in: locales } } };
  switch (entityType) {
    case 'cocktail': {
      const rows = await prisma.cocktailRecipe.findMany({
        where,
        select: { id: true, name: true, description: true, history: true, translations },
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        source: { name: row.name, description: row.description, history: row.history },
        translations: row.translations,
      }));
    }
    case 'ingredient': {
      const rows = await prisma.ingredient.findMany({
        where,
        select: { id: true, name: true, guestName: true, description: true, translations },
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        source: { name: row.name, guestName: row.guestName, description: row.description },
        translations: row.translations,
      }));
    }
    case 'garnish': {
      const rows = await prisma.garnish.findMany({ where, select: { id: true, name: true, description: true, translations }, orderBy: { name: 'asc' } });
      return rows.map((row) => ({ id: row.id, name: row.name, source: { name: row.name, description: row.description }, translations: row.translations }));
    }
    case 'glass': {
      const rows = await prisma.glass.findMany({ where, select: { id: true, name: true, translations }, orderBy: { name: 'asc' } });
      return rows.map((row) => ({ id: row.id, name: row.name, source: { name: row.name }, translations: row.translations }));
    }
  }
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

export async function listContentTranslations(workspace: Workspace, query: ContentTranslationsQuery): Promise<ContentTranslationsDto> {
  const { contentLocales } = await loadWorkspaceLocaleSettings(workspace.id);
  if (query.locale && query.locale === contentLocales.primary) {
    throw new ApiError(400, 'PRIMARY_LOCALE', 'The primary content language is stored on the entities themselves');
  }
  if (query.entityId && !query.entity) {
    throw new ApiError(400, 'VALIDATION_ERROR', '`entityId` requires `entity`');
  }
  const locales = query.locale ? [query.locale] : contentLocales.additional;
  const entityTypes = query.entity ? [query.entity] : CONTENT_TRANSLATION_ENTITY_TYPES;

  const rows: ContentTranslationRow[] = [];
  if (locales.length > 0) {
    for (const entityType of entityTypes) {
      const entities = await loadEntities(workspace.id, entityType, locales, query.entityId);
      for (const entity of entities) {
        for (const field of CONTENT_TRANSLATION_FIELDS[entityType]) {
          const source = entity.source[field] ?? null;
          for (const locale of locales) {
            const value = entity.translations.find((translation) => translation.locale === locale)?.[field] ?? null;
            if (isBlank(source) && isBlank(value)) continue;
            if (query.missingOnly && (isBlank(source) || !isBlank(value))) continue;
            rows.push({ entityType, entityId: entity.id, entityName: entity.name, field, locale, source, value });
          }
        }
      }
    }
  }

  return { primaryLocale: contentLocales.primary, locales, rows };
}

export async function upsertContentTranslations(workspace: Workspace, input: ContentTranslationsUpdateInput): Promise<ContentTranslationsUpdateResult> {
  const { contentLocales } = await loadWorkspaceLocaleSettings(workspace.id);
  if (input.items.some((item) => item.locale === contentLocales.primary)) {
    throw new ApiError(400, 'PRIMARY_LOCALE', 'The primary content language is stored on the entities themselves');
  }

  // Group by entity + locale so each translation row is written once.
  const groups = new Map<string, TranslationGroup>();
  for (const item of input.items) {
    const key = `${item.entityType}\u0000${item.entityId}\u0000${item.locale}`;
    const group = groups.get(key) ?? { entityType: item.entityType, entityId: item.entityId, locale: item.locale, data: {}, count: 0 };
    group.data[item.field] = isBlank(item.value) ? null : item.value!.trim();
    group.count++;
    groups.set(key, group);
  }

  return runTx(
    async (tx) => {
      // Only entities of this workspace may be translated; other ids are skipped.
      const validIds = new Map<ContentTranslationEntityType, Set<string>>();
      for (const entityType of CONTENT_TRANSLATION_ENTITY_TYPES) {
        const ids = [...new Set([...groups.values()].filter((group) => group.entityType === entityType).map((group) => group.entityId))];
        if (ids.length === 0) continue;
        const where = { workspaceId: workspace.id, id: { in: ids } };
        const select = { id: true } as const;
        const found =
          entityType === 'cocktail'
            ? await tx.cocktailRecipe.findMany({ where, select })
            : entityType === 'ingredient'
              ? await tx.ingredient.findMany({ where, select })
              : entityType === 'garnish'
                ? await tx.garnish.findMany({ where, select })
                : await tx.glass.findMany({ where, select });
        validIds.set(entityType, new Set(found.map((row) => row.id)));
      }

      let updated = 0;
      let skipped = 0;
      for (const group of groups.values()) {
        if (!validIds.get(group.entityType)?.has(group.entityId)) {
          skipped += group.count;
          continue;
        }
        await writeGroup(tx, group);
        updated += group.count;
      }
      return { updated, skipped };
    },
    { timeout: BULK_TX_TIMEOUT_MS },
  );
}

/** Upserts one translation row; a row whose fields are all empty is deleted instead. */
async function writeGroup(tx: Tx, group: TranslationGroup): Promise<void> {
  const { entityId, locale, data } = group;
  switch (group.entityType) {
    case 'cocktail': {
      const row = await tx.cocktailRecipeTranslation.upsert({
        where: { cocktailId_locale: { cocktailId: entityId, locale } },
        create: { cocktailId: entityId, locale, name: data.name, description: data.description, history: data.history },
        update: { name: data.name, description: data.description, history: data.history },
      });
      if (row.name == null && row.description == null && row.history == null) {
        await tx.cocktailRecipeTranslation.delete({ where: { cocktailId_locale: { cocktailId: entityId, locale } } });
      }
      break;
    }
    case 'ingredient': {
      const row = await tx.ingredientTranslation.upsert({
        where: { ingredientId_locale: { ingredientId: entityId, locale } },
        create: { ingredientId: entityId, locale, name: data.name, guestName: data.guestName, description: data.description },
        update: { name: data.name, guestName: data.guestName, description: data.description },
      });
      if (row.name == null && row.guestName == null && row.description == null) {
        await tx.ingredientTranslation.delete({ where: { ingredientId_locale: { ingredientId: entityId, locale } } });
      }
      break;
    }
    case 'garnish': {
      const row = await tx.garnishTranslation.upsert({
        where: { garnishId_locale: { garnishId: entityId, locale } },
        create: { garnishId: entityId, locale, name: data.name, description: data.description },
        update: { name: data.name, description: data.description },
      });
      if (row.name == null && row.description == null) {
        await tx.garnishTranslation.delete({ where: { garnishId_locale: { garnishId: entityId, locale } } });
      }
      break;
    }
    case 'glass': {
      const row = await tx.glassTranslation.upsert({
        where: { glassId_locale: { glassId: entityId, locale } },
        create: { glassId: entityId, locale, name: data.name },
        update: { name: data.name },
      });
      if (row.name == null) {
        await tx.glassTranslation.delete({ where: { glassId_locale: { glassId: entityId, locale } } });
      }
      break;
    }
  }
}
