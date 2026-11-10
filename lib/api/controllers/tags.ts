/**
 * Version-agnostic business logic for tags (v1). Same DB operations as the
 * legacy handler: aggregate the distinct tag strings across cocktails and
 * ingredients of a workspace. Tag metadata (definitions + categories) lives in
 * TagDefinition / TagCategory.
 */
import prisma from '../../../prisma/prisma';
import '@lib/ArrayUtils';
import { Prisma } from '@generated/prisma/client';
import type { TagCategory, Workspace } from '@generated/prisma/client';
import type {
  TagCategoriesBulkUpdateInput,
  TagCategoryCreateInput,
  TagCategoryDto,
  TagCategoryUpdateInput,
  TagDefinitionDto,
  TagDefinitionsBulkUpdateInput,
  TagsDto,
} from '@lib/schemas/tags';
import type { DeletionResult } from '@lib/schemas/common';
import type { LocalizedText } from '@lib/guest-menu/localizedText';
import { ApiError } from '@lib/http/ApiError';
import { getMissingDefaultTagCategories } from '@lib/tags/defaultTagCategories';

export async function listTags(workspace: Workspace): Promise<TagsDto> {
  const cocktailTags = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    select: { tags: true },
  });

  const ingredientTags = await prisma.ingredient.findMany({
    where: { workspaceId: workspace.id },
    select: { tags: true },
  });

  return [...cocktailTags, ...ingredientTags]
    .map((tag) => tag.tags)
    .flat()
    .filterUnique();
}

function toLocalizedText(value: unknown): LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: LocalizedText = {};
  for (const [locale, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text === 'string') result[locale] = text;
  }
  return result;
}

/** Drops empty entries so `{ de: 'x', en: '' }` is stored as `{ de: 'x' }`. */
function cleanLocalizedText(value: LocalizedText): LocalizedText {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, text]) => text.trim() !== '')
      .map(([locale, text]) => [locale, text.trim()]),
  );
}

type TagCategoryRow = TagCategory & { _count: { tags: number } };

function toTagCategoryDto(category: TagCategoryRow): TagCategoryDto {
  return {
    id: category.id,
    name: toLocalizedText(category.name),
    order: category.order,
    showAsGuestFilter: category.showAsGuestFilter,
    tagCount: category._count.tags,
  };
}

export async function listTagCategories(workspace: Workspace): Promise<TagCategoryDto[]> {
  const categories = await prisma.tagCategory.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { tags: true } } },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return categories.map(toTagCategoryDto);
}

export async function createTagCategory(workspace: Workspace, input: TagCategoryCreateInput): Promise<TagCategoryDto> {
  let order = input.order;
  if (order == undefined) {
    const last = await prisma.tagCategory.findFirst({ where: { workspaceId: workspace.id }, orderBy: { order: 'desc' }, select: { order: true } });
    order = (last?.order ?? -1) + 1;
  }
  const category = await prisma.tagCategory.create({
    data: {
      workspaceId: workspace.id,
      name: cleanLocalizedText(input.name),
      order,
      showAsGuestFilter: input.showAsGuestFilter ?? true,
    },
    include: { _count: { select: { tags: true } } },
  });
  return toTagCategoryDto(category);
}

export async function updateTagCategory(workspace: Workspace, categoryId: string, input: TagCategoryUpdateInput): Promise<TagCategoryDto> {
  const existing = await prisma.tagCategory.findFirst({ where: { id: categoryId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Tag category not found');
  const category = await prisma.tagCategory.update({
    where: { id: categoryId },
    data: {
      name: input.name ? cleanLocalizedText(input.name) : undefined,
      order: input.order,
      showAsGuestFilter: input.showAsGuestFilter,
    },
    include: { _count: { select: { tags: true } } },
  });
  return toTagCategoryDto(category);
}

export async function upsertTagCategories(workspace: Workspace, input: TagCategoriesBulkUpdateInput): Promise<TagCategoryDto[]> {
  const ids = input.map((category) => category.id).filter((id): id is string => !!id);
  const existing = await prisma.tagCategory.findMany({ where: { workspaceId: workspace.id, id: { in: ids } }, select: { id: true } });
  if (existing.length !== new Set(ids).size) throw new ApiError(404, 'NOT_FOUND', 'Tag category not found');

  await prisma.$transaction(
    input.map((category) =>
      category.id
        ? prisma.tagCategory.update({
            where: { id: category.id },
            data: { name: cleanLocalizedText(category.name), order: category.order, showAsGuestFilter: category.showAsGuestFilter },
          })
        : prisma.tagCategory.create({
            data: {
              workspaceId: workspace.id,
              name: cleanLocalizedText(category.name),
              order: category.order,
              showAsGuestFilter: category.showAsGuestFilter,
            },
          }),
    ),
  );
  return listTagCategories(workspace);
}

export async function deleteTagCategory(workspace: Workspace, categoryId: string): Promise<DeletionResult> {
  return prisma.tagCategory.deleteMany({ where: { id: categoryId, workspaceId: workspace.id } });
}

export async function createDefaultTagCategories(workspace: Workspace): Promise<TagCategoryDto[]> {
  const existing = await prisma.tagCategory.findMany({ where: { workspaceId: workspace.id }, select: { name: true, order: true } });
  const missing = getMissingDefaultTagCategories(existing);
  if (missing.length > 0) {
    await prisma.tagCategory.createMany({
      data: missing.map((category) => ({
        workspaceId: workspace.id,
        name: category.name,
        order: category.order,
        showAsGuestFilter: category.showAsGuestFilter,
      })),
    });
  }
  return listTagCategories(workspace);
}

function countTags(rows: { tags: string[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of new Set(row.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

export async function listTagDefinitions(workspace: Workspace): Promise<TagDefinitionDto[]> {
  const [cocktails, ingredients, definitions] = await Promise.all([
    prisma.cocktailRecipe.findMany({ where: { workspaceId: workspace.id }, select: { tags: true } }),
    prisma.ingredient.findMany({ where: { workspaceId: workspace.id }, select: { tags: true } }),
    prisma.tagDefinition.findMany({ where: { workspaceId: workspace.id } }),
  ]);
  const cocktailCounts = countTags(cocktails);
  const ingredientCounts = countTags(ingredients);
  const definitionsByTag = new Map(definitions.map((definition) => [definition.tag, definition]));
  const allTags = new Set([...cocktailCounts.keys(), ...ingredientCounts.keys(), ...definitionsByTag.keys()]);

  return [...allTags]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => {
      const definition = definitionsByTag.get(tag);
      const label = definition?.label != null ? toLocalizedText(definition.label) : null;
      return {
        tag,
        label,
        categoryId: definition?.categoryId ?? null,
        color: definition?.color ?? null,
        isPublic: definition?.isPublic ?? true,
        defined: definition != undefined,
        cocktailCount: cocktailCounts.get(tag) ?? 0,
        ingredientCount: ingredientCounts.get(tag) ?? 0,
      };
    });
}

export async function upsertTagDefinitions(workspace: Workspace, input: TagDefinitionsBulkUpdateInput): Promise<TagDefinitionDto[]> {
  const categoryIds = [...new Set(input.map((definition) => definition.categoryId).filter((id): id is string => !!id))];
  if (categoryIds.length > 0) {
    const categories = await prisma.tagCategory.count({ where: { workspaceId: workspace.id, id: { in: categoryIds } } });
    if (categories !== categoryIds.length) throw new ApiError(404, 'NOT_FOUND', 'Tag category not found');
  }

  const toJsonLabel = (label: LocalizedText | null | undefined) => {
    if (label === undefined) return undefined;
    const cleaned = label ? cleanLocalizedText(label) : {};
    return Object.keys(cleaned).length > 0 ? cleaned : Prisma.DbNull;
  };

  await prisma.$transaction(
    input.map((definition) =>
      prisma.tagDefinition.upsert({
        where: { workspaceId_tag: { workspaceId: workspace.id, tag: definition.tag } },
        create: {
          workspaceId: workspace.id,
          tag: definition.tag,
          label: toJsonLabel(definition.label),
          categoryId: definition.categoryId ?? null,
          color: definition.color ?? null,
          isPublic: definition.isPublic ?? true,
        },
        update: {
          label: toJsonLabel(definition.label),
          categoryId: definition.categoryId,
          color: definition.color,
          isPublic: definition.isPublic,
        },
      }),
    ),
  );
  return listTagDefinitions(workspace);
}
