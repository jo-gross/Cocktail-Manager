/**
 * Zod schemas + ResourceApiDocs for guest information (allergens, additives,
 * alcohol content). Pure module (zod + type-only enums) so
 * scripts/generate-openapi.ts can import it without the Prisma runtime.
 * See docs/GUEST-MENU-CONCEPT.md, section "Gästeinformationen".
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { ADDITIVES, ALCOHOL_CATEGORIES, ALLERGEN_SOURCES, ALLERGENS } from '@lib/guest-info/constants';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const AllergenSchema = z.enum(ALLERGENS).openapi('Allergen', { description: 'Allergen per Regulation (EU) No 1169/2011, Annex II.' });
export const AllergenSourceSchema = z.enum(ALLERGEN_SOURCES).openapi('AllergenSource', {
  description: 'Specific cereal (GLUTEN) or nut (NUTS) named in Annex II of Regulation (EU) No 1169/2011.',
});
const allergenSourcesInput = z
  .array(AllergenSourceSchema)
  .optional()
  .openapi({ description: 'Specific cereals/nuts behind GLUTEN/NUTS. Sources whose allergen is not set are dropped.' });
export const AdditiveSchema = z.enum(ADDITIVES).openapi('Additive', { description: 'Labelling-relevant additive.' });

/** ABV in % vol (0–100). */
export const AbvSchema = z.coerce.number().min(0).max(100);

/** Guest-information fields shared by the ingredient create/update inputs (all optional → untouched on update). */
export const IngredientGuestInfoInputShape = {
  abv: AbvSchema.nullish().openapi({ description: 'Alcohol by volume in % vol (0–100), null if unknown.' }),
  allergens: z.array(AllergenSchema).optional(),
  allergenSources: allergenSourcesInput,
  additives: z.array(AdditiveSchema).optional(),
  guestInfoComplete: z.boolean().optional().openapi({ description: 'Allergen/additive information has been verified as complete.' }),
  hideOnGuestMenu: z.boolean().optional().openapi({ description: 'Do not list this ingredient on guest menus.' }),
  guestName: z.string().nullish().openapi({ description: 'Name shown to guests instead of the internal name.' }),
};

/** Guest-information fields shared by the garnish create/update inputs (all optional → untouched on update). */
export const GarnishGuestInfoInputShape = {
  allergens: z.array(AllergenSchema).optional(),
  allergenSources: allergenSourcesInput,
  additives: z.array(AdditiveSchema).optional(),
  guestInfoComplete: z.boolean().optional().openapi({ description: 'Allergen/additive information has been verified as complete.' }),
};

/** Guest-information fields of the cocktail create/update inputs (all optional → untouched on update). */
export const CocktailGuestInfoInputShape = {
  abvOverride: AbvSchema.nullish().openapi({ description: 'Manual ABV in % vol; overrides the calculated value. null = calculate.' }),
  extraAllergens: z.array(AllergenSchema).optional().openapi({ description: 'Allergens added on top of the ingredient-derived ones.' }),
  extraAdditives: z.array(AdditiveSchema).optional().openapi({ description: 'Additives added on top of the ingredient-derived ones.' }),
};

export const IngredientGuestInfoDtoShape = {
  abv: z.number().nullable().openapi({ description: 'Alcohol by volume in % vol, null if unknown.' }),
  allergens: z.array(AllergenSchema),
  allergenSources: z.array(AllergenSourceSchema),
  additives: z.array(AdditiveSchema),
  guestInfoComplete: z.boolean(),
  hideOnGuestMenu: z.boolean(),
  guestName: z.string().nullable(),
};

export const GarnishGuestInfoDtoShape = {
  allergens: z.array(AllergenSchema),
  allergenSources: z.array(AllergenSourceSchema),
  additives: z.array(AdditiveSchema),
  guestInfoComplete: z.boolean(),
};

export const CocktailGuestInfoDtoShape = {
  abvOverride: z.number().nullable().openapi({ description: 'Manual ABV in % vol, null when calculated.' }),
  extraAllergens: z.array(AllergenSchema),
  extraAdditives: z.array(AdditiveSchema),
};

export const DerivedGuestInfoSchema = z
  .object({
    allergens: z.array(
      z.object({
        code: AllergenSchema,
        optional: z.boolean().openapi({ description: 'Only contained in optional/alternative components.' }),
        sources: z.array(AllergenSourceSchema).openapi({ description: 'Specified cereals/nuts of the contributing ingredients/garnishes.' }),
      }),
    ),
    additives: z.array(z.object({ code: AdditiveSchema, optional: z.boolean() })),
    complete: z.boolean().openapi({ description: 'All involved ingredients and garnishes have verified guest information.' }),
    alcohol: z.object({
      abv: z.number().nullable().openapi({ description: 'Alcohol by volume in % vol of the served drink (incl. dilution).' }),
      status: z.enum(['calculated', 'manual', 'unknown']),
      category: z.enum(ALCOHOL_CATEGORIES).nullable(),
      alcoholFree: z.boolean(),
      grams: z.number().nullable().openapi({ description: 'Grams of pure alcohol per serving.' }),
      volumeMl: z.number().nullable().openapi({ description: 'Served volume in ml (incl. dilution).' }),
    }),
  })
  .openapi('DerivedGuestInfo');

const GuestInfoSourceSchema = z.object({
  type: z.enum(['ingredient', 'garnish', 'cocktail']),
  id: z.string(),
  name: z.string(),
  optional: z.boolean(),
});

export const CocktailGuestInfoResponseSchema = DerivedGuestInfoSchema.extend({
  sources: z
    .object({
      allergens: z.array(GuestInfoSourceSchema.extend({ code: AllergenSchema })),
      additives: z.array(GuestInfoSourceSchema.extend({ code: AdditiveSchema })),
      incomplete: z
        .array(GuestInfoSourceSchema.omit({ optional: true }))
        .openapi({ description: 'Ingredients/garnishes whose guest information is not complete.' }),
      missingAbv: z.array(GuestInfoSourceSchema.omit({ optional: true })).openapi({ description: 'Required ingredients without ABV or convertible amount.' }),
    })
    .openapi({ description: 'Which component contributes which allergen/additive.' }),
}).openapi('CocktailGuestInfo');

export type CocktailGuestInfoResponse = z.infer<typeof CocktailGuestInfoResponseSchema>;

const OverviewIngredientSchema = z.object({ id: z.string(), name: z.string(), usedInCocktails: z.number().int(), ...IngredientGuestInfoDtoShape });
const OverviewGarnishSchema = z.object({ id: z.string(), name: z.string(), usedInCocktails: z.number().int(), ...GarnishGuestInfoDtoShape });
const CompletenessStatsSchema = z.object({ total: z.number().int(), complete: z.number().int() });

export const GuestInfoOverviewSchema = z
  .object({
    ingredients: z.array(OverviewIngredientSchema),
    garnishes: z.array(OverviewGarnishSchema),
    stats: z.object({
      ingredients: CompletenessStatsSchema.extend({ withAbv: z.number().int() }),
      garnishes: CompletenessStatsSchema,
      cocktails: CompletenessStatsSchema.extend({ abvKnown: z.number().int() }).openapi({ description: 'Non-archived cocktails.' }),
    }),
  })
  .openapi('GuestInfoOverview');

export type GuestInfoOverview = z.infer<typeof GuestInfoOverviewSchema>;
export type GuestInfoOverviewIngredient = z.infer<typeof OverviewIngredientSchema>;
export type GuestInfoOverviewGarnish = z.infer<typeof OverviewGarnishSchema>;

export const GuestInfoBulkUpdateSchema = z
  .object({
    ingredients: z
      .array(
        z.object({
          id: z.string(),
          abv: IngredientGuestInfoInputShape.abv,
          allergens: IngredientGuestInfoInputShape.allergens,
          additives: IngredientGuestInfoInputShape.additives,
          guestInfoComplete: IngredientGuestInfoInputShape.guestInfoComplete,
          hideOnGuestMenu: IngredientGuestInfoInputShape.hideOnGuestMenu,
          guestName: IngredientGuestInfoInputShape.guestName,
        }),
      )
      .max(1000)
      .optional(),
    garnishes: z
      .array(z.object({ id: z.string(), ...GarnishGuestInfoInputShape }))
      .max(1000)
      .optional(),
  })
  .openapi('GuestInfoBulkUpdateInput');

export type GuestInfoBulkUpdateInput = z.infer<typeof GuestInfoBulkUpdateSchema>;

export const GuestInfoBulkUpdateResultSchema = z.object({
  ingredients: z.number().int().openapi({ description: 'Number of updated ingredients.' }),
  garnishes: z.number().int().openapi({ description: 'Number of updated garnishes.' }),
});

export const cocktailGuestInfoApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/guest-info',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.guestInfoCore],
      summary: 'Get derived guest information of a cocktail',
      description:
        'Allergens, additives and alcohol content derived from the ingredients, garnishes and steps of the cocktail (plus manual extras/override), including which component contributes what.',
      params: WorkspaceIdParam.extend({ cocktailId: z.string() }),
      response: CocktailGuestInfoResponseSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const guestInfoOverviewApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-info/overview',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.guestInfoCore],
      summary: 'Guest information overview',
      description: 'All ingredients and garnishes with their guest-information fields, plus completeness statistics.',
      params: WorkspaceIdParam,
      response: GuestInfoOverviewSchema,
    },
  },
} satisfies ResourceApiDoc;

export const guestInfoBulkApiDoc = {
  basePath: '/workspaces/{workspaceId}/guest-info/bulk',
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_UPDATE',
      tags: [ApiTags.guestInfoCore],
      summary: 'Bulk-update guest information',
      description:
        'Updates the guest-information fields of several ingredients and garnishes at once. Omitted fields stay unchanged. API keys need INGREDIENTS_UPDATE, and additionally GARNISHES_UPDATE when garnishes are included.',
      params: WorkspaceIdParam,
      body: GuestInfoBulkUpdateSchema,
      response: GuestInfoBulkUpdateResultSchema,
    },
  },
} satisfies ResourceApiDoc;
