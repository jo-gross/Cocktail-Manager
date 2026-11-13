/**
 * Version-agnostic business logic for the queue (v1). Returns clean public DTOs
 * (lib/api/dto/queue.ts). Every path/body id is scoped to the caller's workspace.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { toQueueItemDto } from '@lib/api/dto/queue';
import type { Db } from '@lib/db/tx';
import type { Prisma, Workspace } from '@generated/prisma/client';
import type { QueueAddInput, QueueItemDto, QueueRemoveInput, QueueUpdateInput } from '@lib/schemas/queue';

const includeCocktail = { cocktail: { select: { id: true, name: true } } } satisfies Prisma.CocktailQueueInclude;

/** Legacy notes normalization: empty/'-' → treated as no notes. */
function normalizeNotes(notes: string | null | undefined): string | undefined {
  return notes ? (notes.trim() == '' || notes.trim() == '-' ? undefined : notes.trim()) : undefined;
}

interface ConsumedQueueItem {
  id: string;
  notes: string | null;
  inProgress: boolean;
  createdAt: Date;
  cocktailId: string;
  cocktailName: string;
}

/**
 * Atomically deletes the oldest queue item of the cocktail whose notes equal
 * `notes` (`null` matches items without notes) and returns it, or null when
 * there is none. `SKIP LOCKED` lets concurrent callers each consume a different
 * item instead of racing for the same row.
 */
export async function consumeOldestQueueItem(db: Db, workspaceId: string, cocktailId: string, notes: string | null): Promise<ConsumedQueueItem | null> {
  const rows = await db.$queryRaw<ConsumedQueueItem[]>`
    WITH consumed AS (
      DELETE FROM "CocktailQueue"
      WHERE id = (
        SELECT id FROM "CocktailQueue"
        WHERE "workspaceId" = ${workspaceId} AND "cocktailId" = ${cocktailId} AND "notes" IS NOT DISTINCT FROM ${notes}::text
        ORDER BY "createdAt" ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, notes, "inProgress", "createdAt", "cocktailId"
    )
    SELECT consumed.id, consumed.notes, consumed."inProgress", consumed."createdAt", consumed."cocktailId", c.name AS "cocktailName"
    FROM consumed JOIN "CocktailRecipe" c ON c.id = consumed."cocktailId"`;
  return rows[0] ?? null;
}

export async function listQueue(workspace: Workspace): Promise<QueueItemDto[]> {
  const queue = await prisma.cocktailQueue.findMany({
    where: { workspaceId: workspace.id },
    include: includeCocktail,
  });
  return queue.map(toQueueItemDto);
}

export async function addToQueue(workspace: Workspace, input: QueueAddInput): Promise<QueueItemDto[]> {
  await assertIdsInWorkspace(prisma, workspace.id, { cocktail: [input.cocktailId] });

  const notes = normalizeNotes(input.notes) ?? null;
  const created = await prisma.cocktailQueue.createManyAndReturn({
    data: Array.from({ length: input.amount ?? 1 }, () => ({ workspaceId: workspace.id, cocktailId: input.cocktailId, notes })),
    include: includeCocktail,
  });
  return created.map(toQueueItemDto);
}

export async function removeFromQueue(workspace: Workspace, input: QueueRemoveInput): Promise<QueueItemDto> {
  // Legacy matches on the trimmed notes, mapping empty/'-' to null.
  const consumed = await consumeOldestQueueItem(prisma, workspace.id, input.cocktailId, normalizeNotes(input.notes) ?? null);
  if (!consumed) {
    throw new ApiError(404, 'NOT_FOUND', 'No cocktail in queue');
  }

  return toQueueItemDto({ ...consumed, cocktail: { id: consumed.cocktailId, name: consumed.cocktailName } });
}

export async function updateQueueItem(workspace: Workspace, queueItemId: string, input: QueueUpdateInput): Promise<QueueItemDto> {
  const { count } = await prisma.cocktailQueue.updateMany({
    where: { id: queueItemId, workspaceId: workspace.id },
    data: { inProgress: input.inProgress },
  });
  if (count === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Queue item not found');
  }

  const updated = await prisma.cocktailQueue.findFirst({ where: { id: queueItemId, workspaceId: workspace.id }, include: includeCocktail });
  if (!updated) {
    throw new ApiError(404, 'NOT_FOUND', 'Queue item not found');
  }
  return toQueueItemDto(updated);
}
