/**
 * Version-agnostic business logic for workspace join codes (v1). Returns clean DTOs and maps a
 * missing code to 404. Codes are unique across ALL workspaces; when the client sends none, a
 * random code is generated server-side.
 */
import crypto from 'crypto';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toJoinCodeDto } from '@lib/api/dto/joinCodes';
import type { Workspace } from '@generated/prisma/client';
import type { JoinCodeCreateInput, JoinCodeDto } from '@lib/schemas/joinCodes';

/** 12 random base64url characters (72 bits) — matches JOIN_CODE_PATTERN. */
function generateJoinCode(): string {
  return crypto.randomBytes(9).toString('base64url');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

export async function listJoinCodes(workspace: Workspace): Promise<JoinCodeDto[]> {
  const codes = await prisma.workspaceJoinCode.findMany({ where: { workspaceId: workspace.id } });
  return codes.map(toJoinCodeDto);
}

export async function createJoinCode(workspace: Workspace, input: JoinCodeCreateInput): Promise<JoinCodeDto> {
  // A generated code colliding is practically impossible, but retry instead of failing if it happens.
  const attempts = input.code ? 1 : 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const created = await prisma.workspaceJoinCode.create({
        data: {
          code: input.code ?? generateJoinCode(),
          expires: input.expires ? new Date(input.expires) : null,
          onlyUseOnce: input.onlyUseOnce ?? false,
          workspaceId: workspace.id,
        },
      });
      return toJoinCodeDto(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (attempt >= attempts) throw new ApiError(409, 'CODE_TAKEN', 'This join code is already in use, please choose another one');
    }
  }
}

export async function deleteJoinCode(workspace: Workspace, code: string): Promise<{ count: number }> {
  const { count } = await prisma.workspaceJoinCode.deleteMany({ where: { workspaceId: workspace.id, code } });
  if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'Join code not found');
  return { count };
}
