/**
 * Prisma → public DTO mapping for glasses. Keeps the /api/v1 contract clean:
 * `hasImage` + `imageUrl` instead of `_count.GlassImage` / embedded base64,
 * and no `workspaceId` (already implied by the path).
 */
import type { Glass } from '@generated/prisma/client';
import type { GlassDto } from '@lib/schemas/glasses';

export function toGlassDto(glass: Pick<Glass, 'id' | 'name' | 'notes' | 'volume' | 'deposit'>, hasImage: boolean, workspaceId: string): GlassDto {
  return {
    id: glass.id,
    name: glass.name,
    notes: glass.notes,
    volume: glass.volume,
    deposit: glass.deposit,
    hasImage,
    imageUrl: hasImage ? `/api/v1/workspaces/${workspaceId}/glasses/${glass.id}/image` : null,
  };
}
