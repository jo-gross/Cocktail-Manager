/**
 * Backup helpers: guest menu documents reference cocktails, ingredients, card
 * groups and custom templates by id. On import all ids are re-generated, so the
 * references inside the JSON documents have to be rewritten.
 */
import { CUSTOM_TEMPLATE_PREFIX, GUEST_MENU_OUTPUTS, type GuestMenuDocument } from './schema';

export interface GuestMenuIdMaps {
  cocktails: ReadonlyMap<string, string>;
  ingredients: ReadonlyMap<string, string>;
  cardGroups: ReadonlyMap<string, string>;
  templates: ReadonlyMap<string, string>;
}

/**
 * Returns a copy of `document` with remapped ids. Unknown references are
 * dropped (cocktails/ingredients) or kept as-is (groups/templates – they then
 * simply resolve to nothing / the default template). Works on unvalidated JSON.
 */
export function remapGuestMenuDocumentIds<T = GuestMenuDocument>(document: T, maps: GuestMenuIdMaps): T {
  if (!document || typeof document !== 'object') return document;
  const doc = structuredClone(document) as unknown as GuestMenuDocument;

  for (const block of Array.isArray(doc.blocks) ? doc.blocks : []) {
    if (block.type !== 'section') continue;
    const source = block.source;
    if (source?.kind === 'manual') {
      source.cocktailIds = source.cocktailIds.flatMap((id) => (maps.cocktails.has(id) ? [maps.cocktails.get(id)!] : []));
    } else if (source?.kind === 'rule') {
      source.ingredientIds = source.ingredientIds.flatMap((id) => (maps.ingredients.has(id) ? [maps.ingredients.get(id)!] : []));
    } else if (source?.kind === 'cardGroup') {
      source.groupId = maps.cardGroups.get(source.groupId) ?? source.groupId;
    }
    if (block.overrides && typeof block.overrides === 'object') {
      block.overrides = Object.fromEntries(
        Object.entries(block.overrides).flatMap(([cocktailId, override]) =>
          maps.cocktails.has(cocktailId) ? [[maps.cocktails.get(cocktailId)!, override]] : [],
        ),
      );
    }
  }

  for (const output of GUEST_MENU_OUTPUTS) {
    const ref = doc.templates?.[output];
    if (ref?.templateId?.startsWith(CUSTOM_TEMPLATE_PREFIX)) {
      const newId = maps.templates.get(ref.templateId.slice(CUSTOM_TEMPLATE_PREFIX.length));
      if (newId) ref.templateId = `${CUSTOM_TEMPLATE_PREFIX}${newId}`;
    }
  }
  return doc as unknown as T;
}
