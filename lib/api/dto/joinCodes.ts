/** Prisma `WorkspaceJoinCode` → clean public DTO (drops `workspaceId`, dates as ISO strings). */
import type { WorkspaceJoinCode } from '@generated/prisma/client';
import type { JoinCodeDto } from '@lib/schemas/joinCodes';

export function toJoinCodeDto(code: Pick<WorkspaceJoinCode, 'code' | 'expires' | 'onlyUseOnce' | 'used' | 'createdAt'>): JoinCodeDto {
  return {
    code: code.code,
    expires: code.expires ? code.expires.toISOString() : null,
    onlyUseOnce: code.onlyUseOnce,
    used: code.used,
    createdAt: code.createdAt.toISOString(),
  };
}
