/**
 * Workspace data the builder needs besides the menu itself: templates, cards
 * (with groups, for group sources and the "not on any card" check), cocktails
 * (manual picker, override names), tags, ingredients and locale settings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiV1Fetch } from '@lib/network/apiV1';
import { getBuiltInGuestMenuTemplates, getGuestMenuTemplates, type BuiltInGuestMenuTemplates } from '@lib/network/guestMenus';
import { getTagCategories, getTagDefinitions } from '@lib/network/tags';
import { getWorkspaceSettings } from '@lib/network/workspaces';
import { getWorkspaceLocaleSettings, type WorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings';
import type { CardDto, CardSummaryDto } from '@lib/schemas/cards';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import type { IngredientDto } from '@lib/schemas/ingredients';
import type { TagCategoryDto, TagDefinitionDto } from '@lib/schemas/tags';
import type { GuestMenuTemplateDto } from '@lib/schemas/guestMenus';

export interface BuilderData {
  loading: boolean;
  builtIn: BuiltInGuestMenuTemplates | null;
  customTemplates: GuestMenuTemplateDto[];
  reloadCustomTemplates: () => Promise<void>;
  /** Non-archived cards with groups. */
  cards: CardDto[];
  cocktails: CocktailSummaryDto[];
  cocktailById: Map<string, CocktailSummaryDto>;
  ingredients: IngredientDto[];
  tagDefinitions: TagDefinitionDto[];
  tagCategories: TagCategoryDto[];
  localeSettings: WorkspaceLocaleSettings | null;
  statisticDayStartTime: string | null;
}

async function settle<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error('guest menu builder data', error);
    return fallback;
  }
}

export function useBuilderData(workspaceId: string | undefined): BuilderData {
  const [loading, setLoading] = useState(true);
  const [builtIn, setBuiltIn] = useState<BuiltInGuestMenuTemplates | null>(null);
  const [customTemplates, setCustomTemplates] = useState<GuestMenuTemplateDto[]>([]);
  const [cards, setCards] = useState<CardDto[]>([]);
  const [cocktails, setCocktails] = useState<CocktailSummaryDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinitionDto[]>([]);
  const [tagCategories, setTagCategories] = useState<TagCategoryDto[]>([]);
  const [localeSettings, setLocaleSettings] = useState<WorkspaceLocaleSettings | null>(null);
  const [statisticDayStartTime, setStatisticDayStartTime] = useState<string | null>(null);

  const reloadCustomTemplates = useCallback(async () => {
    if (!workspaceId) return;
    setCustomTemplates(await settle(getGuestMenuTemplates(workspaceId), []));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const base = `/api/v1/workspaces/${workspaceId}`;
    (async () => {
      setLoading(true);
      const [builtInResult, custom, cardSummaries, cocktailList, ingredientList, definitions, categories, settings] = await Promise.all([
        settle(getBuiltInGuestMenuTemplates(workspaceId), null),
        settle(getGuestMenuTemplates(workspaceId), []),
        settle(apiV1Fetch<CardSummaryDto[]>(`${base}/cards`), []),
        settle(apiV1Fetch<CocktailSummaryDto[]>(`${base}/cocktails`), []),
        settle(apiV1Fetch<IngredientDto[]>(`${base}/ingredients`), []),
        settle(getTagDefinitions(workspaceId), []),
        settle(getTagCategories(workspaceId), []),
        settle(getWorkspaceSettings(workspaceId), null),
      ]);
      const fullCards = await Promise.all(
        cardSummaries.filter((card) => !card.archived).map((card) => settle(apiV1Fetch<CardDto>(`${base}/cards/${card.id}`), null)),
      );
      if (cancelled) return;
      setBuiltIn(builtInResult);
      setCustomTemplates(custom);
      setCards(fullCards.filter((card): card is CardDto => card != null));
      setCocktails(cocktailList.filter((cocktail) => !cocktail.isArchived).sort((a, b) => a.name.localeCompare(b.name)));
      setIngredients([...ingredientList].sort((a, b) => a.name.localeCompare(b.name)));
      setTagDefinitions(definitions);
      setTagCategories(categories);
      setLocaleSettings(settings ? getWorkspaceLocaleSettings(settings) : null);
      setStatisticDayStartTime(settings?.statisticDayStartTime ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const cocktailById = useMemo(() => new Map(cocktails.map((cocktail) => [cocktail.id, cocktail])), [cocktails]);

  return {
    loading,
    builtIn,
    customTemplates,
    reloadCustomTemplates,
    cards,
    cocktails,
    cocktailById,
    ingredients,
    tagDefinitions,
    tagCategories,
    localeSettings,
    statisticDayStartTime,
  };
}
