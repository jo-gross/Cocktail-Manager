/**
 * Server resolver: loads exactly the whitelisted data for a guest menu
 * (strict Prisma `select`s, no notes/prices of ingredients/links) and builds
 * the `PublicMenuDto` via the pure core in resolveCore.ts.
 *
 *   const dto = await resolvePublicMenu({ workspace, menu, document, locale, output, now });
 */
import type { LabelCatalog } from '@lib/i18n/labelFallback';
import prisma from '../../prisma/prisma';
import type { GuestMenu, Prisma, Workspace, WorkspaceSettingKey } from '@generated/prisma/client';
import { findActiveCard } from '@lib/cards/activeCard';
import { loadCocktailGuestInfo } from '@lib/guest-info/loadCocktailGuestInfo.server';
import type { DerivedGuestInfo } from '@lib/guest-info/derive';
import { getWorkspaceLocaleSettings, type RawWorkspaceSettings } from '@lib/workspace/workspaceLocaleSettings';
import type { LocalizedText } from './localizedText';
import type { GuestMenuDocument, GuestMenuOutput, PublicMenuDto } from './schema';
import {
  analyzeDocumentNeeds,
  buildPublicMenuDto,
  type BuildPublicMenuInput,
  type ResolvedMenuMeta,
  type ResolverCard,
  type ResolverCocktail,
  type ResolverData,
} from './resolveCore';

export * from './resolveCore';

export interface ResolvePublicMenuInput {
  workspace: Pick<Workspace, 'id' | 'name' | 'publicSlug'> & { image?: string | null; hasImage?: boolean };
  menu: Pick<GuestMenu, 'id' | 'slug' | 'name' | 'locales' | 'publishedAt' | 'updatedAt' | 'sourceMode' | 'sourceCardId'>;
  /** Published document (public) or draft (preview). Must be schema-valid. */
  document: GuestMenuDocument;
  locale?: string | null;
  /** Fallback locale preferences (Accept-Language) when `locale` is not set. */
  preferredLocales?: string[];
  output?: GuestMenuOutput;
  now?: Date;
  isPreview?: boolean;
  /** Preview token appended to image URLs so drafts can show their images. */
  previewToken?: string | null;
  /** Signage access token appended to image URLs of protected menus. */
  accessToken?: string | null;
}

/** Strict whitelist select for cocktails (never `notes`, never ingredient price/link/notes). */
export const publicCocktailSelect = {
  id: true,
  name: true,
  description: true,
  history: true,
  tags: true,
  price: true,
  isArchived: true,
  unavailableUntil: true,
  _count: { select: { CocktailRecipeImage: true } },
  glass: { select: { id: true, name: true, translations: { select: { locale: true, name: true } } } },
  garnishes: {
    orderBy: { garnishNumber: 'asc' },
    select: {
      optional: true,
      isAlternative: true,
      garnish: { select: { id: true, name: true, translations: { select: { locale: true, name: true } } } },
    },
  },
  steps: {
    orderBy: { stepNumber: 'asc' },
    select: {
      optional: true,
      ingredients: {
        orderBy: { ingredientNumber: 'asc' },
        select: {
          optional: true,
          amount: true,
          unit: { select: { name: true } },
          ingredient: {
            select: {
              id: true,
              name: true,
              guestName: true,
              tags: true,
              hideOnGuestMenu: true,
              translations: { select: { locale: true, name: true, guestName: true } },
            },
          },
        },
      },
    },
  },
  translations: { select: { locale: true, name: true, description: true, history: true } },
} satisfies Prisma.CocktailRecipeSelect;

type PublicCocktailRow = Prisma.CocktailRecipeGetPayload<{ select: typeof publicCocktailSelect }>;

function toResolverCocktail(row: PublicCocktailRow): ResolverCocktail {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    history: row.history,
    tags: row.tags,
    price: row.price,
    isArchived: row.isArchived,
    unavailableUntil: row.unavailableUntil,
    hasImage: row._count.CocktailRecipeImage > 0,
    glass: row.glass,
    garnishes: row.garnishes.map((entry) => ({ optional: entry.optional ?? false, isAlternative: entry.isAlternative ?? false, garnish: entry.garnish })),
    steps: row.steps.map((step) => ({
      optional: step.optional,
      ingredients: step.ingredients.map((entry) => ({
        optional: entry.optional,
        amount: entry.amount,
        unitName: entry.unit?.name ?? null,
        ingredient: entry.ingredient,
      })),
    })),
    translations: row.translations,
  };
}

const SETTING_KEYS = ['timezone', 'currency', 'contentLocales', 'statisticDayStartTime'] as WorkspaceSettingKey[];

export async function loadWorkspaceGuestSettings(workspaceId: string) {
  const rows = await prisma.workspaceSetting.findMany({ where: { workspaceId, setting: { in: SETTING_KEYS } } });
  const raw: RawWorkspaceSettings = {};
  for (const row of rows) raw[row.setting] = row.value;
  return { ...getWorkspaceLocaleSettings(raw), dayStartTime: raw.statisticDayStartTime ?? null };
}

function parseLabelCatalog(value: string | null | undefined): LabelCatalog {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as LabelCatalog) : {};
  } catch {
    return {};
  }
}

async function loadCard(cardId: string, workspaceId: string): Promise<ResolverCard | null> {
  const card = await prisma.cocktailCard.findFirst({
    where: { id: cardId, workspaceId },
    select: {
      id: true,
      name: true,
      groups: {
        select: {
          id: true,
          name: true,
          groupNumber: true,
          groupPrice: true,
          items: { select: { cocktailId: true, itemNumber: true, specialPrice: true } },
        },
      },
    },
  });
  return card;
}

export async function resolveSourceCard(
  workspaceId: string,
  menu: Pick<GuestMenu, 'sourceMode' | 'sourceCardId'>,
  now: Date,
  settings: { timezone: string; dayStartTime: string | null },
): Promise<ResolverCard | null> {
  if (menu.sourceMode === 'FIXED_CARD' && menu.sourceCardId) return loadCard(menu.sourceCardId, workspaceId);
  if (menu.sourceMode === 'ACTIVE_CARD') {
    const cards = await prisma.cocktailCard.findMany({ where: { workspaceId, archived: false }, select: { id: true, name: true, date: true, archived: true } });
    const active = findActiveCard(cards, now, { timezone: settings.timezone, dayStartTime: settings.dayStartTime });
    return active ? loadCard(active.id, workspaceId) : null;
  }
  return null;
}

/** Loads everything `buildPublicMenuDto` needs (only what the document uses). */
export async function loadResolverData(input: ResolvePublicMenuInput): Promise<ResolverData> {
  const workspaceId = input.workspace.id;
  const output = input.output ?? 'web';
  const now = input.now ?? new Date();
  const needs = analyzeDocumentNeeds(input.document, output);
  const settings = await loadWorkspaceGuestSettings(workspaceId);
  const sourceCard = needs.needsCard ? await resolveSourceCard(workspaceId, input.menu, now, settings) : null;

  const referencedIds = new Set<string>(needs.manualCocktailIds);
  for (const group of sourceCard?.groups ?? []) for (const item of group.items) referencedIds.add(item.cocktailId);

  const [cocktailRows, tagDefinitions, tagCategories, labelSetting] = await Promise.all([
    needs.needsAllCocktails || referencedIds.size > 0
      ? prisma.cocktailRecipe.findMany({
          where: needs.needsAllCocktails
            ? { workspaceId, OR: [{ isArchived: false }, { id: { in: [...referencedIds] } }] }
            : { workspaceId, id: { in: [...referencedIds] } },
          select: publicCocktailSelect,
        })
      : Promise.resolve([] as PublicCocktailRow[]),
    prisma.tagDefinition.findMany({ where: { workspaceId }, select: { tag: true, label: true, categoryId: true, color: true, isPublic: true } }),
    prisma.tagCategory.findMany({ where: { workspaceId }, select: { id: true, name: true, order: true, showAsGuestFilter: true } }),
    prisma.workspaceSetting.findUnique({ where: { workspaceId_setting: { workspaceId, setting: 'translations' } }, select: { value: true } }),
  ]);
  const cocktails = new Map(cocktailRows.map((row) => [row.id, toResolverCocktail(row)]));
  const ids = [...cocktails.keys()];

  const [guestInfo, ratings] = await Promise.all([
    needs.needsGuestInfo && ids.length > 0 ? loadCocktailGuestInfo(workspaceId, ids) : Promise.resolve(new Map<string, DerivedGuestInfo>()),
    needs.needsRatings && ids.length > 0
      ? prisma.cocktailRating.groupBy({ by: ['cocktailId'], where: { cocktailId: { in: ids } }, _avg: { rating: true }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  return {
    settings,
    sourceCard,
    cocktails,
    guestInfo,
    labels: parseLabelCatalog(labelSetting?.value),
    tagDefinitions: tagDefinitions.map((definition) => ({ ...definition, label: (definition.label as LocalizedText | null) ?? null })),
    tagCategories: tagCategories.map((category) => ({ ...category, name: (category.name as LocalizedText) ?? {} })),
    ratings: new Map(ratings.map((row) => [row.cocktailId, { average: Math.round((row._avg.rating ?? 0) * 10) / 10, count: row._count._all }])),
  };
}

function toBuildInput(input: ResolvePublicMenuInput): BuildPublicMenuInput {
  const { workspace, menu } = input;
  return {
    workspace: { id: workspace.id, name: workspace.name, publicSlug: workspace.publicSlug, hasImage: workspace.hasImage ?? !!workspace.image },
    menu: { id: menu.id, slug: menu.slug, name: menu.name, locales: menu.locales, publishedAt: menu.publishedAt, updatedAt: menu.updatedAt },
    document: input.document,
    output: input.output,
    locale: input.locale,
    preferredLocales: input.preferredLocales,
    now: input.now,
    isPreview: input.isPreview,
    previewToken: input.previewToken,
    accessToken: input.accessToken,
  };
}

export async function resolvePublicMenuWithMeta(input: ResolvePublicMenuInput): Promise<{ dto: PublicMenuDto; meta: ResolvedMenuMeta }> {
  const data = await loadResolverData(input);
  return buildPublicMenuDto(toBuildInput(input), data);
}

export async function resolvePublicMenu(input: ResolvePublicMenuInput): Promise<PublicMenuDto> {
  return (await resolvePublicMenuWithMeta(input)).dto;
}
