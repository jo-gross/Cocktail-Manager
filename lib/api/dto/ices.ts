/**
 * Prisma → public DTO mapping for ice. Keeps the /api/v1 contract clean: no
 * `workspaceId` (already implied by the path) and no relation counts.
 */
import type { Ice } from '@generated/prisma/client';
import type { IceDto } from '@lib/schemas/ices';

export function toIceDto(ice: Pick<Ice, 'id' | 'name'>): IceDto {
  return {
    id: ice.id,
    name: ice.name,
  };
}
