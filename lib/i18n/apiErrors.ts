import { i18n } from './client';

/**
 * Maps known API error codes to i18n keys under the `errors` namespace.
 * Prefer code-based translation; fall back to the server message, then a caller fallback.
 */
const CODE_TO_KEY: Record<string, string> = {
  NO_CALCULATIONS_SELECTED: 'errors:noCalculationsSelected',
  NO_COCKTAILS_SELECTED: 'errors:noCocktailsSelected',
  NO_GLASSES_SELECTED: 'errors:noGlassesSelected',
  NO_GARNISHES_SELECTED: 'errors:noGarnishesSelected',
  NO_INGREDIENTS_SELECTED: 'errors:noIngredientsSelected',
  NO_DECISIONS: 'errors:noDecisions',
  INVALID_PHASE: 'errors:invalidPhase',
  INVALID_GROUP: 'errors:invalidGroup',
  GROUP_NAME_TAKEN: 'errors:groupNameTaken',
  GROUP_NOT_FOUND: 'errors:groupNotFound',
  GLASSES_NOT_FOUND: 'errors:glassesNotFound',
  GARNISHES_NOT_FOUND: 'errors:garnishesNotFound',
  INGREDIENTS_NOT_FOUND: 'errors:ingredientsNotFound',
  CALCULATIONS_NOT_FOUND: 'errors:calculationsNotFound',
  EXCLUSIVE_OVERLAP: 'errors:exclusiveTimeConflict',
  GLASS_IN_USE: 'errors:glassInUse',
  INGREDIENT_IN_USE: 'errors:ingredientInUse',
  INVALID_JSON: 'errors:invalidJsonStructure',
  IMPORT_FAILED: 'errors:importCocktails',
  EXPORT_FAILED: 'errors:export',
  NO_GROUP_ID: 'errors:noGroupId',
  CREATE_GROUP_FAILED: 'errors:createGroup',
  UPDATE_GROUP_FAILED: 'errors:updateGroup',
  NETWORK: 'errors:network',
};

/** Legacy German (and English) server messages → i18n keys when no code is available. */
const MESSAGE_TO_KEY: Record<string, string> = {
  'Keine Cocktails ausgewählt': 'errors:noCocktailsSelected',
  'No cocktails selected': 'errors:noCocktailsSelected',
  'Keine Gläser ausgewählt': 'errors:noGlassesSelected',
  'No glasses selected': 'errors:noGlassesSelected',
  'Keine Garnituren ausgewählt': 'errors:noGarnishesSelected',
  'No garnishes selected': 'errors:noGarnishesSelected',
  'Keine Zutaten ausgewählt': 'errors:noIngredientsSelected',
  'No ingredients selected': 'errors:noIngredientsSelected',
  'Keine Kalkulationen ausgewählt': 'errors:noCalculationsSelected',
  'No calculations selected': 'errors:noCalculationsSelected',
  'Keine Gläser gefunden': 'errors:glassesNotFound',
  'No glasses found': 'errors:glassesNotFound',
  'Keine Garnituren gefunden': 'errors:garnishesNotFound',
  'No garnishes found': 'errors:garnishesNotFound',
  'Keine Zutaten gefunden': 'errors:ingredientsNotFound',
  'No ingredients found': 'errors:ingredientsNotFound',
  'Keine Kalkulationen gefunden': 'errors:calculationsNotFound',
  'No calculations found': 'errors:calculationsNotFound',
  'Keine Entscheidungen angegeben': 'errors:noDecisions',
  'No decisions provided': 'errors:noDecisions',
  'Ungültige Phase': 'errors:invalidPhase',
  'Invalid phase': 'errors:invalidPhase',
  'Ungültige Gruppe': 'errors:invalidGroup',
  'Invalid group': 'errors:invalidGroup',
  'Gruppe nicht gefunden': 'errors:groupNotFound',
  'Group not found': 'errors:groupNotFound',
  'Eine Gruppe mit diesem Namen existiert bereits': 'errors:groupNameTaken',
  'A group with this name already exists': 'errors:groupNameTaken',
  'Ungültige JSON-Struktur': 'errors:invalidJsonStructure',
  'Invalid JSON structure': 'errors:invalidJsonStructure',
  'Fehler beim Importieren der Cocktails': 'errors:importCocktails',
  'Failed to import cocktails': 'errors:importCocktails',
  'Fehler beim Exportieren': 'errors:export',
  'Failed to export': 'errors:export',
  'Fehler beim Exportieren der Cocktails': 'errors:export',
  'Failed to export cocktails': 'errors:export',
  'Fehler beim Erstellen der Gruppe': 'errors:createGroup',
  'Failed to create group': 'errors:createGroup',
  'Fehler beim Aktualisieren der Gruppe': 'errors:updateGroup',
  'Failed to update group': 'errors:updateGroup',
  'Keine Gruppen-ID': 'errors:noGroupId',
  'No group ID': 'errors:noGroupId',
  'Fehler beim Abrufen des Bildes': 'errors:loadImage',
  'Failed to fetch image': 'errors:loadImage',
  'Exklusive Zeiträume überschneiden sich mit bestehenden exklusiven Karten': 'errors:exclusiveTimeConflict',
  'Exclusive time ranges overlap with existing exclusive cards': 'errors:exclusiveTimeConflict',
  'Exklusive Zeiträume überschneiden sich': 'errors:exclusiveTimeConflict',
  Netzwerkfehler: 'errors:network',
  'Network error': 'errors:network',
};

export function resolveApiErrorMessage(code: string | undefined, message: string | undefined, fallback: string): string {
  const translate = (key: string) => i18n.t(key as never) as string;
  if (code && CODE_TO_KEY[code]) {
    return translate(CODE_TO_KEY[code]);
  }
  if (message && MESSAGE_TO_KEY[message]) {
    return translate(MESSAGE_TO_KEY[message]);
  }
  if (message && message.trim().length > 0) {
    return message;
  }
  return fallback;
}
