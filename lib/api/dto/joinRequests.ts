/** Prisma `WorkspaceJoinRequest` (+user) → clean DTO: drops `workspaceId`, slims the user ref. */
import type { User, WorkspaceJoinRequest } from '@generated/prisma/client';
import type { JoinRequestDto } from '@lib/schemas/joinRequests';

type JoinRequestWithUser = Pick<WorkspaceJoinRequest, 'userId' | 'date'> & { user: Pick<User, 'id' | 'name' | 'email' | 'image'> };

export function toJoinRequestDto(request: JoinRequestWithUser): JoinRequestDto {
  return {
    userId: request.userId,
    date: request.date.toISOString(),
    user: { id: request.user.id, name: request.user.name, email: request.user.email, image: request.user.image },
  };
}
