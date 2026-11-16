/** Guide progress (tours, checklists) of the session user. */
import type { User, UserGuideProgress } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import type { GuideProgressDto, GuideProgressUpdateInput } from '@lib/schemas/guides';

function toDto(row: UserGuideProgress): GuideProgressDto {
  return { guideId: row.guideId, status: row.status, version: row.version, updatedAt: row.updatedAt.toISOString() };
}

export async function listGuideProgress(user: Pick<User, 'id'>): Promise<GuideProgressDto[]> {
  const rows = await prisma.userGuideProgress.findMany({ where: { userId: user.id }, orderBy: { guideId: 'asc' } });
  return rows.map(toDto);
}

/** Bounds the rows per user (guide ids are client-chosen). */
const MAX_GUIDES_PER_USER = 1000;

export async function setGuideProgress(user: Pick<User, 'id'>, guideId: string, input: GuideProgressUpdateInput): Promise<GuideProgressDto> {
  const existing = await prisma.userGuideProgress.findUnique({ where: { userId_guideId: { userId: user.id, guideId } }, select: { guideId: true } });
  if (!existing && (await prisma.userGuideProgress.count({ where: { userId: user.id } })) >= MAX_GUIDES_PER_USER) {
    throw new ApiError(400, 'TOO_MANY_GUIDES', 'Too many guides stored for this user');
  }
  const row = await prisma.userGuideProgress.upsert({
    where: { userId_guideId: { userId: user.id, guideId } },
    create: { userId: user.id, guideId, status: input.status, version: input.version },
    update: { status: input.status, version: input.version },
  });
  return toDto(row);
}
