// v1 migration: the frontend "glass model" is now the clean public DTO
// (hasImage/imageUrl instead of _count.GlassImage), sourced from /api/v1.
export type { GlassDto as GlassModel } from '@lib/schemas/glasses';
