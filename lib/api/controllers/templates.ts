/**
 * Templates (start content collections) for workspace members: list, items for a
 * selection dialog, apply. Logic lives in lib/templates/*.
 */
import type { User, Workspace, WorkspaceTemplate } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { resolveLocalizedText, type LocalizedText } from '@lib/guest-menu/localizedText';
import { applyTemplate, ensureBuiltInTemplatesSafe, findTemplate } from '@lib/templates/applyTemplate';
import { builtInImageCredits, type TemplateCreditKind } from '@lib/templates/credits';
import type { TemplateApplyInput, TemplateApplyResultDto, TemplateItemsDto, TemplateListQuery, TemplateSummaryDto } from '@lib/schemas/templates';

const countSelect = { _count: { select: { Glass: true, Ingredient: true, Garnish: true, CocktailRecipe: true, CocktailCard: true } } } as const;

function localized(text: unknown, locale: string | undefined, locales: string[]): string {
  const primary = locales[0] ?? 'de';
  return resolveLocalizedText(text && typeof text === 'object' ? (text as LocalizedText) : null, locale ?? primary, primary);
}

function primaryLocaleOf(template: Pick<WorkspaceTemplate, 'locales'>): string {
  return template.locales[0] ?? 'de';
}

export async function listTemplates(query: TemplateListQuery): Promise<TemplateSummaryDto[]> {
  await ensureBuiltInTemplatesSafe();
  const templates = await prisma.workspaceTemplate.findMany({
    where: { published: true, ...(query.kind ? { kind: query.kind } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    include: { workspace: { select: countSelect } },
  });
  return templates.map((template) => {
    const description = template.description ? localized(template.description, query.locale, template.locales) : '';
    const counts = template.workspace._count;
    return {
      key: template.key,
      kind: template.kind,
      name: localized(template.name, query.locale, template.locales) || template.key,
      description: description || null,
      locales: template.locales,
      source: template.source,
      builtIn: template.builtIn,
      version: template.version,
      isDefault: template.isDefault,
      sortOrder: template.sortOrder,
      counts: {
        glasses: counts.Glass,
        ingredients: counts.Ingredient,
        garnishes: counts.Garnish,
        cocktails: counts.CocktailRecipe,
        cards: counts.CocktailCard,
      },
    };
  });
}

/** Name in `locale` (translation) or the primary name. */
function nameIn(row: { name: string; translations: Array<{ name: string | null }> }): string {
  const translated = row.translations[0]?.name;
  return translated && translated.trim() !== '' ? translated : row.name;
}

export async function getTemplateItems(key: string, requestedLocale: string | undefined): Promise<TemplateItemsDto> {
  const template = await findTemplate(key, true);
  const workspaceId = template.workspaceId;
  const locale = requestedLocale ?? primaryLocaleOf(template);
  const translations = { where: { locale }, select: { name: true } } as const;

  const [glasses, ingredients, garnishes, cocktails, cards] = await Promise.all([
    prisma.glass.findMany({ where: { workspaceId }, select: { id: true, name: true, translations, _count: { select: { GlassImage: true } } } }),
    prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true, translations, _count: { select: { IngredientImage: true } } } }),
    prisma.garnish.findMany({ where: { workspaceId }, select: { id: true, name: true, translations, _count: { select: { GarnishImage: true } } } }),
    prisma.cocktailRecipe.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        glassId: true,
        translations,
        _count: { select: { CocktailRecipeImage: true } },
        garnishes: { select: { garnishId: true }, orderBy: { garnishNumber: 'asc' } },
        steps: { select: { ingredients: { select: { ingredientId: true }, orderBy: { ingredientNumber: 'asc' } } }, orderBy: { stepNumber: 'asc' } },
      },
    }),
    prisma.cocktailCard.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        groups: { select: { items: { select: { cocktailId: true }, orderBy: { itemNumber: 'asc' } } }, orderBy: { groupNumber: 'asc' } },
      },
    }),
  ]);

  const byName = <T extends { name: string }>(rows: T[]) => rows.sort((a, b) => a.name.localeCompare(b.name, locale));
  const unique = (ids: Array<string | null>) => [...new Set(ids.filter((id): id is string => id != null))];
  const credits = builtInImageCredits(template);
  /** Items are matched by their primary name (`row.name`), see lib/templates/credits.ts. */
  const toItem = (kind: TemplateCreditKind, row: { id: string; name: string; translations: Array<{ name: string | null }> }, imageCount: number) => ({
    id: row.id,
    name: nameIn(row),
    hasImage: imageCount > 0,
    imageCredit: imageCount > 0 ? (credits?.[kind].get(row.name) ?? null) : null,
  });

  return {
    key: template.key,
    locale,
    glasses: byName(glasses.map((row) => toItem('glass', row, row._count.GlassImage))),
    ingredients: byName(ingredients.map((row) => toItem('ingredient', row, row._count.IngredientImage))),
    garnishes: byName(garnishes.map((row) => toItem('garnish', row, row._count.GarnishImage))),
    cocktails: byName(
      cocktails.map((row) => ({
        ...toItem('cocktail', row, row._count.CocktailRecipeImage),
        glassId: row.glassId,
        ingredientIds: unique(row.steps.flatMap((step) => step.ingredients.map((ingredient) => ingredient.ingredientId))),
        garnishIds: unique(row.garnishes.map((garnish) => garnish.garnishId)),
      })),
    ),
    cards: byName(
      cards.map((card) => ({ id: card.id, name: card.name, cocktailIds: unique(card.groups.flatMap((group) => group.items.map((item) => item.cocktailId))) })),
    ),
  };
}

export function applyTemplateToWorkspace(workspace: Workspace, user: User, key: string, input: TemplateApplyInput): Promise<TemplateApplyResultDto> {
  return applyTemplate(workspace.id, key, {
    mode: input.mode,
    selection: input.selection,
    locale: input.locale,
    user,
    publishedOnly: true,
  });
}
