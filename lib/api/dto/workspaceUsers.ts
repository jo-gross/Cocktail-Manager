/**
 * Prisma → public DTO mapping for workspace users. Keeps the /api/v1 contract
 * clean: flattens the joined `user` into the membership, exposes the `role`, and
 * drops `workspaceId` (already implied by the path).
 */
import type { User, WorkspaceUser } from '@generated/prisma/client';
import type { WorkspaceUserDto } from '@lib/schemas/workspaceUsers';

export function toWorkspaceUserDto(membership: Pick<WorkspaceUser, 'userId' | 'role'> & { user: Pick<User, 'name' | 'email' | 'image'> }): WorkspaceUserDto {
  return {
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    image: membership.user.image,
    role: membership.role,
  };
}
