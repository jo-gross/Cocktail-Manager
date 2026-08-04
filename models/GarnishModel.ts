// v1 migration: the frontend "garnish model" is now the clean public DTO
// (hasImage/imageUrl instead of _count.GarnishImage), sourced from /api/v1.
export type { GarnishDto as GarnishModel } from '@lib/schemas/garnishes';
