/**
 * Version-agnostic business logic for cards (cocktail cards / menus, v1). Same DB
 * operations as the legacy handlers, but returns clean public DTOs (lib/api/dto/cards.ts).
 * Legacy routes remain wrapped-but-untouched and keep their raw Prisma shapes.
 *
 * Note: the legacy card handlers do NOT write audit logs (unlike glasses), so
 * these controllers faithfully replicate that — no createLog calls.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toCardDto, toCardSummaryDto } from '@lib/api/dto/cards';
import type { Prisma, Workspace } from '@generated/prisma/client';
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

async function findFullCardOrThrow(cardId: string): Promise<CardDto> {
  const card = await prisma.cocktailCard.findUnique({ where: { id: cardId }, include: fullCardInclude });
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
  return toCardDto(card);
}

export async function listCards(workspace: Workspace, opts: { withArchived?: boolean }): Promise<CardSummaryDto[]> {
  const where: Prisma.CocktailCardWhereInput = { workspaceId: workspace.id };
  if (!opts.withArchived) {
    where.archived = false;
  }
  const cards = await prisma.cocktailCard.findMany({
    where,
    include: {
      groups: {
        include: {
          _count: { select: { items: true } },
        },
      },
    },
  });
  return cards.map((card) =>
    toCardSummaryDto({
      id: card.id,
      name: card.name,
      date: card.date,
      archived: card.archived,
      groupCount: card.groups.length,
      itemCount: card.groups.reduce((sum, group) => sum + group._count.items, 0),
    }),
  );
}

export async function getCard(workspace: Workspace, cardId: string): Promise<CardDto | null> {
  const card = await prisma.cocktailCard.findFirst({
    where: { id: cardId, workspaceId: workspace.id },
    include: fullCardInclude,
  });
  return card ? toCardDto(card) : null;
}

export async function createCard(workspace: Workspace, input: CardCreateInput): Promise<CardDto> {
  const created = await prisma.$transaction(async (tx) => {
    const card = await tx.cocktailCard.create({
      data: {
        id: input.id,
        name: input.name,
        date: input.date ?? undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    for (const group of input.groups ?? []) {
      const groupResult = await tx.cocktailCardGroup.create({
        data: {
          id: group.id,
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice ?? undefined,
          cocktailCard: { connect: { id: card.id } },
        },
      });

      for (const item of group.items ?? []) {
        await tx.cocktailCardGroupItem.create({
          data: {
            cocktail: { connect: { id: item.cocktailId } },
            cocktailCardGroup: { connect: { id: groupResult.id } },
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice ?? undefined,
          },
        });
      }
    }

    return card;
  });

  return findFullCardOrThrow(created.id);
}

export async function updateCard(workspace: Workspace, cardId: string, input: CardUpdateInput): Promise<CardDto> {
  await prisma.$transaction(async (tx) => {
    await tx.cocktailCardGroupItem.deleteMany({
      where: { cocktailCardGroup: { cocktailCard: { id: cardId } } },
    });
    await tx.cocktailCardGroup.deleteMany({
      where: { cocktailCard: { id: cardId } },
    });

    await tx.cocktailCard.update({
      where: { id: cardId },
      data: {
        name: input.name,
        date: input.date ?? undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    for (const group of input.groups ?? []) {
      const groupResult = await tx.cocktailCardGroup.create({
        data: {
          id: group.id,
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice ?? undefined,
          cocktailCard: { connect: { id: cardId } },
        },
      });

      for (const item of group.items ?? []) {
        await tx.cocktailCardGroupItem.create({
          data: {
            cocktail: { connect: { id: item.cocktailId } },
            cocktailCardGroup: { connect: { id: groupResult.id } },
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice ?? undefined,
          },
        });
      }
    }
  });

  return findFullCardOrThrow(cardId);
}

export async function deleteCard(workspace: Workspace, cardId: string): Promise<{ count: number }> {
  await prisma.$transaction(async (tx) => {
    await tx.cocktailCardGroupItem.deleteMany({ where: { cocktailCardGroup: { cocktailCardId: cardId } } });
    await tx.cocktailCardGroup.deleteMany({ where: { cocktailCardId: cardId } });
    await tx.cocktailCard.delete({ where: { id: cardId, workspaceId: workspace.id } });
  });

  return { count: 1 };
}

export async function archiveCard(workspace: Workspace, cardId: string, archived: boolean): Promise<CardSummaryDto> {
  const existing = await prisma.cocktailCard.findFirst({ where: { id: cardId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Card not found');

  const updated = await prisma.cocktailCard.update({
    where: { id: cardId },
    data: { archived },
    include: {
      groups: {
        include: {
          _count: { select: { items: true } },
        },
      },
    },
  });

  return toCardSummaryDto({
    id: updated.id,
    name: updated.name,
    date: updated.date,
    archived: updated.archived,
    groupCount: updated.groups.length,
    itemCount: updated.groups.reduce((sum, group) => sum + group._count.items, 0),
  });
}

export async function cloneCard(workspace: Workspace, cardId: string, name: string): Promise<CardDto> {
  const clone = await prisma.$transaction(async (tx) => {
    const existing = await tx.cocktailCard.findFirst({ where: { id: cardId, workspaceId: workspace.id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Card not found');

    const createClone = await tx.cocktailCard.create({
      data: {
        id: undefined,
        name,
        createdAt: undefined,
        updatedAt: undefined,
        workspaceId: workspace.id,
        date: existing.date,
        archived: existing.archived,
      },
    });

    const groups = await tx.cocktailCardGroup.findMany({
      where: { cocktailCardId: existing.id },
      include: { items: true },
    });

    for (const group of groups) {
      const createGroup = await tx.cocktailCardGroup.create({
        data: {
          id: undefined,
          name: group.name,
          groupNumber: group.groupNumber,
          groupPrice: group.groupPrice,
          cocktailCard: { connect: { id: createClone.id } },
        },
      });

      for (const item of group.items) {
        await tx.cocktailCardGroupItem.create({
          data: {
            itemNumber: item.itemNumber,
            specialPrice: item.specialPrice,
            cocktailCardGroup: { connect: { id: createGroup.id } },
            cocktail: { connect: { id: item.cocktailId } },
          },
        });
      }
    }

    return createClone;
  });

  return findFullCardOrThrow(clone.id);
}
