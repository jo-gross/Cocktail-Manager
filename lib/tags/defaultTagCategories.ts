/**
 * Default tag categories offered via "Standardkategorien anlegen" and created
 * for new workspaces. Names are LocalizedText (`de` + `en`). Pure module.
 */
import type { LocalizedText } from '@lib/guest-menu/localizedText';

export interface DefaultTagCategory {
  name: LocalizedText;
  order: number;
  showAsGuestFilter: boolean;
}

export const DEFAULT_TAG_CATEGORIES: DefaultTagCategory[] = [
  { name: { de: 'Geschmack', en: 'Flavor' }, order: 0, showAsGuestFilter: true },
  { name: { de: 'Spirituose', en: 'Spirit' }, order: 1, showAsGuestFilter: true },
  { name: { de: 'Stil', en: 'Style' }, order: 2, showAsGuestFilter: true },
  { name: { de: 'Eigenschaften', en: 'Properties' }, order: 3, showAsGuestFilter: true },
  { name: { de: 'Saison', en: 'Season' }, order: 4, showAsGuestFilter: false },
];

function normalizeName(value: string | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

/**
 * Returns the default categories that do not exist yet (matched by any
 * localized name, case-insensitive), with orders appended after `existing`.
 */
export function getMissingDefaultTagCategories(existing: { name: unknown; order: number }[]): DefaultTagCategory[] {
  const existingNames = new Set<string>();
  for (const category of existing) {
    if (category.name && typeof category.name === 'object') {
      for (const value of Object.values(category.name as Record<string, unknown>)) {
        if (typeof value === 'string') existingNames.add(normalizeName(value));
      }
    }
  }
  const maxOrder = existing.reduce((max, category) => Math.max(max, category.order), -1);
  return DEFAULT_TAG_CATEGORIES.filter((category) => !Object.values(category.name).some((value) => existingNames.has(normalizeName(value)))).map(
    (category, index) => ({ ...category, name: { ...category.name }, order: maxOrder + 1 + index }),
  );
}
