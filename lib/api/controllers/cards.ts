/**
 * Version-agnostic business logic for cards (cocktail cards / menus, v1).
 * Returns clean public DTOs (lib/api/dto/cards.ts). Every path/body id is scoped
 * to the caller's workspace; state changes write a `CocktailCard` audit log in
 * the same transaction.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { ApiError } from '@lib/http/ApiError';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { runTx, type Db, type Tx } from '@lib/db/tx';
import { toCardDto, toCardSummaryDto } from '@lib/api/dto/cards';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import type { CardCreateInput, CardDto, CardSummaryDto, CardUpdateInput } from '@lib/schemas/cards';

/** Full include tree that satisfies `toCardDto` (groups → items → slim cocktail ref). */
const fullCardInclude = {
  groups: {
    include: {
      items: {
        include: {
          cocktail: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.CocktailCardInclude;

const summaryCardInclude = {
  groups: {
    include: {
      _count: { select: { items: true } },
    },
  },
} satisfies Prisma.CocktailCardInclude;

type FullCard = Prisma.CocktailCardGetPayload<{ include: typeof fullCardInclude }>;
type SummaryCard = Prisma.CocktailCardGetPayload<{ include: typeof summaryCardInclude }>;

function toSummary(card: SummaryCard): CardSummaryDto {
  return toCardSummaryDto({
    id: card.id,
    name: card.name,
    date: card.date,
    archived: card.archived,
    groupCount: card.groups.length,
    itemCount: card.groups.reduce((sum, group) => sum + group._count.items, 0),
  });
}

/** Audit snapshot: names instead of ids, ordered like the card. */
function auditSnapshot(card: FullCard): Record<string, unknown> {
  return {
    name: card.name,
    date: card.date ? card.date.toISOString() : null,
    archived: card.archived,
    groups: [...card.groups]
      .sort((a, b) => a.groupNumber - b.groupNumber)
      .map((group) => ({
        name: group.name,
        groupPrice: group.groupPrice,
        items: [...group.items].sort((a, b) => a.itemNumber - b.itemNumber).map((item) => ({ cocktail: item.cocktail.name, specialPrice: item.specialPrice })),
      })),
  };
}

async function findFullCard(db: Db, workspaceId: string, cardId: string): Promise<FullCard | null> {
  return db.cocktailCard.findFirst({ where: { id: cardId, workspaceId }, include: fullCardInclude });
}

async function findFullCardOrThrow(db: Db, workspaceId: string, cardId: string): Promise<FullCard> {
  const card = await findFullCard(db, workspaceId, cardId);
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return card;
}

/** Locks the card row for the rest of the transaction and proves it belongs to the workspace (404 otherwise). */
async function lockCard(tx: Tx, workspaceId: string, cardId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "CocktailCard" WHERE id = ${cardId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
}

type CardGroupsInput = CardCreateInput['groups'];

/** Every cocktail must belong to the workspace and appear at most once per group (composite key). */
async function assertGroupsValid(tx: Tx, workspaceId: string, groups: CardGroupsInput): Promise<void> {
  for (const group of groups ?? []) {
    const cocktailIds = (group.items ?? []).map((item) => item.cocktailId);
    if (new Set(cocktailIds).size !== cocktailIds.length) {
      throw new ApiError(400, 'DUPLICATE_ITEMS', `A cocktail appears more than once in group "${group.name}"`);
    }
  }
  await assertIdsInWorkspace(tx, workspaceId, { cocktail: (groups ?? []).flatMap((group) => (group.items ?? []).map((item) => item.cocktailId)) });
}

async function createGroupItems(tx: Tx, groupId: string, items: NonNullable<NonNullable<CardGroupsInput>[number]['items']>): Promise<void> {
  for (const item of items) {
    await tx.cocktailCardGroupItem.create({
      data: {
        cocktailId: item.cocktailId,
        cocktailCardGroupId: groupId,
        itemNumber: item.itemNumber,
        specialPrice: item.specialPrice ?? undefined,
      },
    });
  }
}

export async function listCards(workspace: Workspace, opts: { withArchived?: boolean }): Promise<CardSummaryDto[]> {
  const where: Prisma.CocktailCardWhereInput = { workspaceId: workspace.id };
  if (!opts.withArchived) {
    where.archived = false;
  }
  const cards = await prisma.cocktailCard.findMany({ where, include: summaryCardInclude });
  return cards.map(toSummary);
}

export async function getCard(workspace: Workspace, cardId: string): Promise<CardDto | null> {
  const card = await findFullCard(prisma, workspace.id, cardId);
  return card ? toCardDto(card) : null;
}

export async function createCard(workspace: Workspace, user: User, input: CardCreateInput): Promise<CardDto> {
  const created = await runTx(async (tx) => {
    await assertGroupsValid(tx, workspace.id, input.groups);

    const card = await tx.cocktailCard.create({
      data: {
        id: input.id,
        name: input.name,
        date: input.date ?? undefined,
        workspaceId: workspace.id,
      },
    });

    for (const group of input.groups ?? []) {
      const groupResult = await tx.cocktailCardGroup.create({
        data: {
          id: group.id,
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice ?? undefined,
          cocktailCardId: card.id,
        },
      });
      await createGroupItems(tx, groupResult.id, group.items ?? []);
    }

    const full = await findFullCardOrThrow(tx, workspace.id, card.id);
    await createLog(tx, workspace.id, user.id, 'CocktailCard', card.id, 'CREATE', null, auditSnapshot(full));
    return full;
  });

  return toCardDto(created);
}

/**
 * Updates a card while keeping group IDs stable (guest menus reference them):
 * groups whose `id` already belongs to this card are updated in place, groups
 * without a known id are created and groups missing from the input are deleted.
 * Items are always recreated (they have no own id).
 */
export async function updateCard(workspace: Workspace, user: User, cardId: string, input: CardUpdateInput): Promise<CardDto> {
  const updated = await runTx(async (tx) => {
    await lockCard(tx, workspace.id, cardId);
    await assertGroupsValid(tx, workspace.id, input.groups);

    const before = await findFullCardOrThrow(tx, workspace.id, cardId);
    const existingGroupIds = new Set(before.groups.map((group) => group.id));
    const keptGroupIds = new Set((input.groups ?? []).map((group) => group.id).filter((id): id is string => id != undefined && existingGroupIds.has(id)));

    await tx.cocktailCardGroupItem.deleteMany({
      where: { cocktailCardGroup: { cocktailCardId: cardId } },
    });
    await tx.cocktailCardGroup.deleteMany({
      where: { cocktailCardId: cardId, id: { notIn: [...keptGroupIds] } },
    });

    await tx.cocktailCard.update({
      where: { id: cardId, workspaceId: workspace.id },
      data: {
        name: input.name,
        // undefined keeps the current date, null clears it
        date: input.date,
      },
    });

    for (const group of input.groups ?? []) {
      const groupData = {
        name: group.name,
        groupNumber: group.groupNumber,
        groupPrice: group.groupPrice ?? null,
      };
      const groupResult =
        group.id != undefined && keptGroupIds.has(group.id)
          ? await tx.cocktailCardGroup.update({ where: { id: group.id, cocktailCardId: cardId }, data: groupData })
          : await tx.cocktailCardGroup.create({ data: { ...groupData, id: group.id, cocktailCardId: cardId } });
      await createGroupItems(tx, groupResult.id, group.items ?? []);
    }

    const after = await findFullCardOrThrow(tx, workspace.id, cardId);
    await createLog(tx, workspace.id, user.id, 'CocktailCard', cardId, 'UPDATE', auditSnapshot(before), auditSnapshot(after));
    return after;
  });

  return toCardDto(updated);
}

export async function deleteCard(workspace: Workspace, user: User, cardId: string): Promise<{ count: number }> {
  await runTx(async (tx) => {
    await lockCard(tx, workspace.id, cardId);
    const before = await findFullCardOrThrow(tx, workspace.id, cardId);

    await tx.cocktailCardGroupItem.deleteMany({ where: { cocktailCardGroup: { cocktailCardId: cardId } } });
    await tx.cocktailCardGroup.deleteMany({ where: { cocktailCardId: cardId } });
    await tx.cocktailCard.delete({ where: { id: cardId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'CocktailCard', cardId, 'DELETE', auditSnapshot(before), null);
  });

  return { count: 1 };
}

export async function archiveCard(workspace: Workspace, user: User, cardId: string, archived: boolean): Promise<CardSummaryDto> {
  const updated = await runTx(async (tx) => {
    await lockCard(tx, workspace.id, cardId);
    const before = await findFullCardOrThrow(tx, workspace.id, cardId);

    const card = await tx.cocktailCard.update({
      where: { id: cardId, workspaceId: workspace.id },
      data: { archived },
      include: summaryCardInclude,
    });
    await createLog(tx, workspace.id, user.id, 'CocktailCard', cardId, 'UPDATE', auditSnapshot(before), auditSnapshot({ ...before, archived }));
    return card;
  });

  return toSummary(updated);
}

export async function cloneCard(workspace: Workspace, user: User, cardId: string, name: string): Promise<CardDto> {
  const clone = await runTx(async (tx) => {
    const existing = await findFullCardOrThrow(tx, workspace.id, cardId);

    const createClone = await tx.cocktailCard.create({
      data: {
        name,
        workspaceId: workspace.id,
        date: existing.date,
        archived: existing.archived,
      },
    });

    for (const group of existing.groups) {
      const createGroup = await tx.cocktailCardGroup.create({
        data: {
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice,
          cocktailCardId: createClone.id,
        },
      });

      for (const item of group.items) {
        await tx.cocktailCardGroupItem.create({
          data: {
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice,
            cocktailCardGroupId: createGroup.id,
            cocktailId: item.cocktail.id,
          },
        });
      }
    }

    const full = await findFullCardOrThrow(tx, workspace.id, createClone.id);
    await createLog(tx, workspace.id, user.id, 'CocktailCard', createClone.id, 'CREATE', null, auditSnapshot(full));
    return full;
  });

  return toCardDto(clone);
}
