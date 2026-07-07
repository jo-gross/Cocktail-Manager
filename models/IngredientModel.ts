// v1 migration: the frontend "ingredient model" is now the clean public DTO
// (volumes/hasImage/imageUrl instead of IngredientVolume/_count), sourced from /api/v1.
export type { IngredientDto as IngredientModel } from '@lib/schemas/ingredients';
