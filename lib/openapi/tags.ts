/**
 * OpenAPI tag names, root `tags` metadata and `x-tagGroups` for docs navigation.
 *
 * Sidebar shape (two levels from the spec + operations):
 *   Cocktails          ← x-tagGroup.name
 *     Core             ← tag x-displayName
 *       [GET] List …
 */

/** Tag strings referenced from ResourceApiDoc.operations.*.tags */
export const ApiTags = {
  workspaceCore: 'Workspace / Core',
  workspaceSettings: 'Workspace / Settings',
  workspaceApiKeys: 'Workspace / API keys',
  workspaceJoinCodes: 'Workspace / Join codes',
  workspaceMembership: 'Workspace / Membership',
  workspaceUsersCore: 'Workspace Users / Core',
  auditLogsCore: 'Audit Logs / Core',

  cocktailsCore: 'Cocktails / Core',
  cocktailsStepActions: 'Cocktails / Step actions',
  cocktailsLifecycle: 'Cocktails / Lifecycle',
  cocktailsImportExport: 'Cocktails / Import & export',
  cocktailsMedia: 'Cocktails / Media',

  ingredientsCore: 'Ingredients / Core',
  ingredientsLifecycle: 'Ingredients / Lifecycle',
  ingredientsImportExport: 'Ingredients / Import & export',
  ingredientsMedia: 'Ingredients / Media',
  ingredientsReferences: 'Ingredients / References',

  garnishesCore: 'Garnishes / Core',
  garnishesLifecycle: 'Garnishes / Lifecycle',
  garnishesImportExport: 'Garnishes / Import & export',
  garnishesMedia: 'Garnishes / Media',

  glassesCore: 'Glasses / Core',
  glassesLifecycle: 'Glasses / Lifecycle',
  glassesImportExport: 'Glasses / Import & export',
  glassesMedia: 'Glasses / Media',
  glassesReferences: 'Glasses / References',

  iceCore: 'Ice / Core',
  tagsCore: 'Tags / Core',

  unitsCore: 'Units / Core',
  unitsConversions: 'Units / Conversions',

  cardsCore: 'Cards / Core',
  cardsLifecycle: 'Cards / Lifecycle',

  calculationsCore: 'Calculations / Core',
  calculationsGroups: 'Calculations / Groups',
  calculationsImportExport: 'Calculations / Import & export',

  monitorConfiguration: 'Monitor / Configuration',
  monitorSlides: 'Monitor / Slides',

  queueCore: 'Queue / Core',
  statisticsLogging: 'Statistics / Logging',
  statisticsAdvanced: 'Statistics / Advanced',
  ratingsCore: 'Ratings / Core',
} as const;

export type ApiTagName = (typeof ApiTags)[keyof typeof ApiTags];

type OpenApiTagObject = {
  name: ApiTagName;
  description: string;
  'x-displayName'?: string;
  'x-position'?: number;
};

function subTag(displayName: string, description: string, position: number): Pick<OpenApiTagObject, 'x-displayName' | 'x-position' | 'description'> {
  return { description, 'x-displayName': displayName, 'x-position': position };
}

/** Root-level `tags` array — documents every tag and controls sidebar order. */
export const OPENAPI_TAGS: OpenApiTagObject[] = [
  { name: ApiTags.workspaceCore, ...subTag('Core', 'Workspace identity and lifecycle.', 1) },
  { name: ApiTags.workspaceSettings, ...subTag('Settings', 'Workspace settings and translations.', 2) },
  { name: ApiTags.workspaceApiKeys, ...subTag('API keys', 'Create, list and revoke workspace API keys.', 3) },
  { name: ApiTags.workspaceJoinCodes, ...subTag('Join codes', 'Invite codes for joining a workspace.', 4) },
  { name: ApiTags.workspaceMembership, ...subTag('Membership', 'Join requests and leaving a workspace.', 5) },
  { name: ApiTags.workspaceUsersCore, ...subTag('Core', 'Workspace member list and roles.', 1) },
  { name: ApiTags.auditLogsCore, ...subTag('Core', 'Audit log entries.', 1) },

  { name: ApiTags.cocktailsCore, ...subTag('Core', 'List, create, read, update and delete cocktail recipes.', 1) },
  { name: ApiTags.cocktailsStepActions, ...subTag('Step actions', 'Cocktail-recipe step actions (SHAKE, STIR, …).', 2) },
  { name: ApiTags.cocktailsLifecycle, ...subTag('Lifecycle', 'Clone, archive and unarchive cocktails.', 3) },
  { name: ApiTags.cocktailsImportExport, ...subTag('Import & export', 'JSON/PDF export and JSON import for cocktails.', 4) },
  { name: ApiTags.cocktailsMedia, ...subTag('Media', 'Cocktail image bytes.', 5) },

  { name: ApiTags.ingredientsCore, ...subTag('Core', 'List, create, read, update and delete ingredients.', 1) },
  { name: ApiTags.ingredientsLifecycle, ...subTag('Lifecycle', 'Clone ingredients.', 2) },
  { name: ApiTags.ingredientsImportExport, ...subTag('Import & export', 'JSON export and import for ingredients.', 3) },
  { name: ApiTags.ingredientsMedia, ...subTag('Media', 'Ingredient image bytes.', 4) },
  { name: ApiTags.ingredientsReferences, ...subTag('References', 'Cocktails that reference an ingredient.', 5) },

  { name: ApiTags.garnishesCore, ...subTag('Core', 'List, create, read, update and delete garnishes.', 1) },
  { name: ApiTags.garnishesLifecycle, ...subTag('Lifecycle', 'Clone garnishes.', 2) },
  { name: ApiTags.garnishesImportExport, ...subTag('Import & export', 'JSON export and import for garnishes.', 3) },
  { name: ApiTags.garnishesMedia, ...subTag('Media', 'Garnish image bytes.', 4) },

  { name: ApiTags.glassesCore, ...subTag('Core', 'List, create, read, update and delete glasses.', 1) },
  { name: ApiTags.glassesLifecycle, ...subTag('Lifecycle', 'Clone glasses.', 2) },
  { name: ApiTags.glassesImportExport, ...subTag('Import & export', 'JSON export and import for glasses.', 3) },
  { name: ApiTags.glassesMedia, ...subTag('Media', 'Glass image bytes.', 4) },
  { name: ApiTags.glassesReferences, ...subTag('References', 'Cocktails that reference a glass.', 5) },

  { name: ApiTags.iceCore, ...subTag('Core', 'List, create, read, update and delete ice types.', 1) },
  { name: ApiTags.tagsCore, ...subTag('Core', 'List cocktail tags.', 1) },

  { name: ApiTags.unitsCore, ...subTag('Core', 'List, create and delete measurement units.', 1) },
  { name: ApiTags.unitsConversions, ...subTag('Conversions', 'Unit conversion factors.', 2) },

  { name: ApiTags.cardsCore, ...subTag('Core', 'List, create, read, update and delete cocktail cards.', 1) },
  { name: ApiTags.cardsLifecycle, ...subTag('Lifecycle', 'Clone, archive and unarchive cards.', 2) },

  { name: ApiTags.calculationsCore, ...subTag('Core', 'Price calculations CRUD.', 1) },
  { name: ApiTags.calculationsGroups, ...subTag('Groups', 'Calculation groups and assignments.', 2) },
  { name: ApiTags.calculationsImportExport, ...subTag('Import & export', 'JSON export and import for calculations.', 3) },

  { name: ApiTags.monitorConfiguration, ...subTag('Configuration', 'Signage / monitor configuration.', 1) },
  { name: ApiTags.monitorSlides, ...subTag('Slides', 'Signage slide upload, schedule and images.', 2) },

  { name: ApiTags.queueCore, ...subTag('Core', 'Bar order queue.', 1) },
  { name: ApiTags.statisticsLogging, ...subTag('Logging', 'Cocktail statistics and logs.', 1) },
  { name: ApiTags.statisticsAdvanced, ...subTag('Advanced', 'Advanced analytics, sets and comparisons.', 2) },
  { name: ApiTags.ratingsCore, ...subTag('Core', 'Cocktail ratings.', 1) },
];

/** One x-tagGroup per resource. Every tag must appear in exactly one group. */
export const OPENAPI_TAG_GROUPS: Array<{ name: string; tags: ApiTagName[] }> = [
  {
    name: 'Workspace',
    tags: [
      ApiTags.workspaceCore,
      ApiTags.workspaceSettings,
      ApiTags.workspaceApiKeys,
      ApiTags.workspaceJoinCodes,
      ApiTags.workspaceMembership,
    ],
  },
  { name: 'Workspace Users', tags: [ApiTags.workspaceUsersCore] },
  { name: 'Audit Logs', tags: [ApiTags.auditLogsCore] },
  {
    name: 'Cocktails',
    tags: [
      ApiTags.cocktailsCore,
      ApiTags.cocktailsStepActions,
      ApiTags.cocktailsLifecycle,
      ApiTags.cocktailsImportExport,
      ApiTags.cocktailsMedia,
    ],
  },
  {
    name: 'Ingredients',
    tags: [
      ApiTags.ingredientsCore,
      ApiTags.ingredientsLifecycle,
      ApiTags.ingredientsImportExport,
      ApiTags.ingredientsMedia,
      ApiTags.ingredientsReferences,
    ],
  },
  {
    name: 'Garnishes',
    tags: [ApiTags.garnishesCore, ApiTags.garnishesLifecycle, ApiTags.garnishesImportExport, ApiTags.garnishesMedia],
  },
  {
    name: 'Glasses',
    tags: [
      ApiTags.glassesCore,
      ApiTags.glassesLifecycle,
      ApiTags.glassesImportExport,
      ApiTags.glassesMedia,
      ApiTags.glassesReferences,
    ],
  },
  { name: 'Ice', tags: [ApiTags.iceCore] },
  { name: 'Tags', tags: [ApiTags.tagsCore] },
  { name: 'Units', tags: [ApiTags.unitsCore, ApiTags.unitsConversions] },
  { name: 'Cards', tags: [ApiTags.cardsCore, ApiTags.cardsLifecycle] },
  {
    name: 'Calculations',
    tags: [ApiTags.calculationsCore, ApiTags.calculationsGroups, ApiTags.calculationsImportExport],
  },
  { name: 'Monitor', tags: [ApiTags.monitorConfiguration, ApiTags.monitorSlides] },
  { name: 'Queue', tags: [ApiTags.queueCore] },
  { name: 'Statistics', tags: [ApiTags.statisticsLogging, ApiTags.statisticsAdvanced] },
  { name: 'Ratings', tags: [ApiTags.ratingsCore] },
];
