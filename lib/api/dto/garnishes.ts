/**
 * Prisma → public DTO mapping for garnishes. Keeps the /api/v1 contract clean:
 * `hasImage` + `imageUrl` instead of `_count.GarnishImage` / embedded base64,
 * and no `workspaceId` (already implied by the path).
 */
import type { Garnish } from '@generated/prisma/client';
import type { GarnishDto } from '@lib/schemas/garnishes';

export function toGarnishDto(garnish: Pick<Garnish, 'id' | 'name' | 'description' | 'notes' | 'price'>, hasImage: boolean, workspaceId: string): GarnishDto {
  return {
    id: garnish.id,
    name: garnish.name,
    description: garnish.description,
    notes: garnish.notes,
    price: garnish.price,
    hasImage,
    imageUrl: hasImage ? `/api/v1/workspaces/${workspaceId}/garnishes/${garnish.id}/image` : null,
  };
}
