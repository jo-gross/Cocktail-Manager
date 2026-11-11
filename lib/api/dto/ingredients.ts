/**
 * Prisma → public DTO mapping for ingredients. Keeps the /api/v1 contract clean:
 * `hasImage` + `imageUrl` instead of `_count.IngredientImage` / embedded base64,
 * camelCase `volumes` instead of the raw `IngredientVolume` relation, and no
 * `workspaceId` (already implied by the path).
 */
import type { Ingredient, IngredientVolume, Unit } from '@generated/prisma/client';
import type { IngredientDto } from '@lib/schemas/ingredients';

type IngredientVolumeWithUnit = Pick<IngredientVolume, 'id' | 'volume'> & { unit: Pick<Unit, 'id' | 'name'> };

type IngredientWithVolumes = Pick<
  Ingredient,
  | 'id'
  | 'name'
  | 'shortName'
  | 'description'
  | 'notes'
  | 'price'
  | 'link'
  | 'tags'
  | 'abv'
  | 'allergens'
  | 'allergenSources'
  | 'additives'
  | 'guestInfoComplete'
  | 'hideOnGuestMenu'
  | 'guestName'
> & {
  IngredientVolume: IngredientVolumeWithUnit[];
};

export function toIngredientDto(ingredient: IngredientWithVolumes, hasImage: boolean, workspaceId: string): IngredientDto {
  return {
    id: ingredient.id,
    name: ingredient.name,
    shortName: ingredient.shortName,
    description: ingredient.description,
    notes: ingredient.notes,
    price: ingredient.price,
    link: ingredient.link,
    tags: ingredient.tags,
    volumes: ingredient.IngredientVolume.map((volume) => ({
      id: volume.id,
      volume: volume.volume,
      unit: { id: volume.unit.id, name: volume.unit.name },
    })),
    hasImage,
    imageUrl: hasImage ? `/api/v1/workspaces/${workspaceId}/ingredients/${ingredient.id}/image` : null,
    abv: ingredient.abv,
    allergens: ingredient.allergens,
    allergenSources: ingredient.allergenSources,
    additives: ingredient.additives,
    guestInfoComplete: ingredient.guestInfoComplete,
    hideOnGuestMenu: ingredient.hideOnGuestMenu,
    guestName: ingredient.guestName,
  };
}
