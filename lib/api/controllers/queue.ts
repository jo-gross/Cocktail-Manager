/**
 * Version-agnostic business logic for the queue (v1). Same DB operations as the
 * legacy handlers (pages/api/workspaces/[workspaceId]/queue/*), but returns
 * clean public DTOs (lib/api/dto/queue.ts). Legacy routes remain
 * wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toQueueItemDto } from '@lib/api/dto/queue';
import type { Prisma, Workspace } from '@generated/prisma/client';
import type { QueueAddInput, QueueItemDto, QueueRemoveInput, QueueUpdateInput } from '@lib/schemas/queue';

const includeCocktail = { cocktail: { select: { id: true, name: true } } } satisfies Prisma.CocktailQueueInclude;

/** Legacy notes normalization: empty/'-' → treated as no notes. */
function normalizeNotes(notes: string | null | undefined): string | undefined {
  return notes ? (notes.trim() == '' || notes.trim() == '-' ? undefined : notes.trim()) : undefined;
}

export async function listQueue(workspace: Workspace): Promise<QueueItemDto[]> {
  const queue = await prisma.cocktailQueue.findMany({
    where: { workspaceId: workspace.id },
    include: includeCocktail,
  });
  return queue.map(toQueueItemDto);
}

export async function addToQueue(workspace: Workspace, input: QueueAddInput): Promise<QueueItemDto[]> {
  const data: Prisma.CocktailQueueCreateInput = {
    workspace: { connect: { id: workspace.id } },
    cocktail: { connect: { id: input.cocktailId } },
    notes: normalizeNotes(input.notes),
  };

  const results: QueueItemDto[] = [];
  for (let i = 0; i < (input.amount ?? 1); i++) {
    const created = await prisma.cocktailQueue.create({ data, include: includeCocktail });
    results.push(toQueueItemDto(created));
  }
  return results;
}

export async function removeFromQueue(workspace: Workspace, input: QueueRemoveInput): Promise<QueueItemDto> {
  // Legacy matches on the trimmed notes, mapping empty/'-' to null.
  const notesTrimmed = input.notes ? (input.notes.trim() == '' || input.notes.trim() == '-' ? null : input.notes.trim()) : null;

  const firstQueueItem = await prisma.cocktailQueue.findFirst({
    where: { workspaceId: workspace.id, cocktailId: input.cocktailId, notes: notesTrimmed },
    orderBy: { createdAt: 'asc' },
    include: includeCocktail,
  });

  if (!firstQueueItem) {
    throw new ApiError(404, 'NOT_FOUND', 'No cocktail in queue');
  }

  const deleted = await prisma.cocktailQueue.delete({ where: { id: firstQueueItem.id }, include: includeCocktail });
  return toQueueItemDto(deleted);
}

export async function updateQueueItem(workspace: Workspace, queueItemId: string, input: QueueUpdateInput): Promise<QueueItemDto> {
  const existing = await prisma.cocktailQueue.findFirst({ where: { id: queueItemId, workspaceId: workspace.id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', 'Queue item not found');
  }

  const updated = await prisma.cocktailQueue.update({
    where: { id: queueItemId },
    data: { inProgress: input.inProgress },
    include: includeCocktail,
  });
  return toQueueItemDto(updated);
}
