/**
 * Zod schemas + ResourceApiDocs for the Cards resource (cocktail cards / menus, v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/cards.ts), NOT the raw Prisma shape.
 *
 * Prisma-ism cleanup: PascalCase relations `CocktailCardGroup`/`CocktailCardGroupItem`
 * become camelCase `groups`/`items`; the item's `cocktailId` + relation collapse to a
 * slim `cocktail: { id, name }` ref; no `workspaceId` (implied by the path).
 *
 * List vs. detail: the collection (`GET /cards`) returns the SLIM `CardSummaryDto`
 * (no nested groups) to keep menu listings light; the item view (`GET /cards/{cardId}`)
 * returns the FULL `CardDto` with nested groups and items.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Slim cocktail reference embedded in a card item (Prisma `CocktailRecipe` → `{ id, name }`). */
export const CardCocktailRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CardCocktailRef');

/** A single card item (Prisma `CocktailCardGroupItem` → clean shape). Has no own id (composite PK). */
export const CardItemDtoSchema = z
  .object({
    cocktail: CardCocktailRefSchema,
    itemNumber: z.number().int().openapi({ description: 'Ordering index of the item within its group.' }),
    specialPrice: z.number().nullable().openapi({ description: 'Overridden price for this item on this card, or null.' }),
  })
  .openapi('CardItem');

/** A group of items on a card (Prisma `CocktailCardGroup` → clean shape, camelCase `items`). */
export const CardGroupDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    groupNumber: z.number().int().openapi({ description: 'Ordering index of the group within the card.' }),
    groupPrice: z.number().nullable().openapi({ description: 'Uniform price applied to the whole group, or null.' }),
    items: z.array(CardItemDtoSchema),
  })
  .openapi('CardGroup');

/** Slim card DTO for list views — no nested groups. */
export const CardSummaryDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    date: DateTimeString.nullable().openapi({ description: 'Optional date the card is scheduled for.' }),
    archived: z.boolean(),
  })
  .openapi('CardSummary');

/** Full card DTO — camelCase `groups` instead of the raw `CocktailCardGroup` relation, no `workspaceId`. */
export const CardDtoSchema = CardSummaryDtoSchema.extend({
  groups: z.array(CardGroupDtoSchema),
}).openapi('Card');

export type CardCocktailRef = z.infer<typeof CardCocktailRefSchema>;
export type CardItemDto = z.infer<typeof CardItemDtoSchema>;
export type CardGroupDto = z.infer<typeof CardGroupDtoSchema>;
export type CardSummaryDto = z.infer<typeof CardSummaryDtoSchema>;
export type CardDto = z.infer<typeof CardDtoSchema>;

/** Nested item input for create/update (mirrors the legacy `items: [{ cocktailId, itemNumber, specialPrice }]`). */
export const CardItemInputSchema = z.object({
  cocktailId: z.string(),
  itemNumber: z.coerce.number().int().optional().openapi({ description: 'Ordering index; auto-assigned when omitted.' }),
  specialPrice: z.coerce.number().nullish().openapi({ description: 'Overridden price for this item, or null.' }),
});

/** Nested group input for create/update. */
export const CardGroupInputSchema = z.object({
  id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
  name: z.string().min(1),
  groupNumber: z.coerce.number().int().optional().openapi({ description: 'Ordering index; auto-assigned when omitted.' }),
  groupPrice: z.coerce.number().nullish().openapi({ description: 'Uniform group price, or null.' }),
  items: z.array(CardItemInputSchema).optional().openapi({ description: 'Items in this group.' }),
});

export const CardCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    date: z.coerce.date().nullish().openapi({ description: 'Optional date the card is scheduled for.' }),
    groups: z.array(CardGroupInputSchema).optional().openapi({ description: 'Groups (with their items) to create.' }),
  })
  .openapi('CardCreateInput');

export const CardUpdateSchema = z
  .object({
    name: z.string().min(1),
    date: z.coerce.date().nullish().openapi({ description: 'Optional date the card is scheduled for.' }),
    groups: z.array(CardGroupInputSchema).optional().openapi({ description: 'Groups (with their items); fully replaces the existing groups/items.' }),
  })
  .openapi('CardUpdateInput');

export const CardCloneSchema = z
  .object({
    name: z.string().min(1).openapi({ description: 'Name for the cloned card.' }),
  })
  .openapi('CardCloneInput');

export const CardListQuerySchema = z.object({
  // Legacy semantics: archived cards are included only when the literal string 'true' is passed.
  withArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
    .openapi({ type: 'boolean', description: 'Include archived cards when true (default false).' }),
});

export const CardItemParams = WorkspaceIdParam.extend({ cardId: z.string() });

export type CardCreateInput = z.infer<typeof CardCreateSchema>;
export type CardUpdateInput = z.infer<typeof CardUpdateSchema>;
export type CardCloneInput = z.infer<typeof CardCloneSchema>;
export type CardListQuery = z.infer<typeof CardListQuerySchema>;

export const cardsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/cards',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CARDS_READ',
      tags: ['Cards'],
      summary: 'List cards',
      description: 'List all cocktail cards of a workspace. Returns a slim summary without nested groups; use GET /cards/{cardId} for the full card.',
      params: WorkspaceIdParam,
      query: CardListQuerySchema,
      response: z.array(CardSummaryDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'CARDS_CREATE',
      tags: ['Cards'],
      summary: 'Create card',
      params: WorkspaceIdParam,
      body: CardCreateSchema,
      response: CardDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const cardsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/cards/{cardId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CARDS_READ',
      tags: ['Cards'],
      summary: 'Get card',
      description: 'Returns the full card including nested groups and items.',
      params: CardItemParams,
      response: CardDtoSchema,
      errorResponses: { 404: 'Card not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'CARDS_UPDATE',
      tags: ['Cards'],
      summary: 'Update card',
      description: 'Replaces the card metadata and its full set of groups/items.',
      params: CardItemParams,
      body: CardUpdateSchema,
      response: CardDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'CARDS_DELETE',
      tags: ['Cards'],
      summary: 'Delete card',
      params: CardItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const cardsArchiveApiDoc = {
  basePath: '/workspaces/{workspaceId}/cards/{cardId}/archive',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'CARDS_UPDATE',
      tags: ['Cards'],
      summary: 'Archive card',
      params: CardItemParams,
      response: CardSummaryDtoSchema,
      errorResponses: { 404: 'Card not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cardsUnarchiveApiDoc = {
  basePath: '/workspaces/{workspaceId}/cards/{cardId}/unarchive',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'CARDS_UPDATE',
      tags: ['Cards'],
      summary: 'Unarchive card',
      params: CardItemParams,
      response: CardSummaryDtoSchema,
      errorResponses: { 404: 'Card not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cardsCloneApiDoc = {
  basePath: '/workspaces/{workspaceId}/cards/{cardId}/clone',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'CARDS_CREATE',
      tags: ['Cards'],
      summary: 'Clone card',
      description: 'Creates a deep copy of a card (groups and items) under a new name.',
      params: CardItemParams,
      body: CardCloneSchema,
      response: CardDtoSchema,
      errorResponses: { 404: 'Card not found.' },
    },
  },
} satisfies ResourceApiDoc;
