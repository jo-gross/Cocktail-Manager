/**
 * Seeds one row of (almost) every tenant-owned entity into a workspace. Names and
 * image bytes carry `marker`, so a test can detect whether a response leaked them.
 */
import { randomBytes } from 'node:crypto';
import prisma from '../../../prisma/prisma';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import type { SeededWorkspace } from '../dbFixtures';
import type { Prisma } from '@generated/prisma/client';

export interface TenantGraph {
  marker: string;
  ids: Record<string, string>;
}

function imageWithMarker(marker: string): string {
  const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(marker)]);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

export async function seedTenantGraph(seeded: SeededWorkspace, marker: string): Promise<TenantGraph> {
  const workspaceId = seeded.workspace.id;
  const owner = seeded.users.find((u) => u.role === 'OWNER') ?? seeded.users[0]!;
  const member = seeded.users.find((u) => u.role === 'USER') ?? seeded.users[0]!;
  const image = imageWithMarker(marker);
  const name = (kind: string) => `${marker} ${kind}`;

  const unit = await prisma.unit.create({ data: { name: name('unit'), workspaceId } });
  const unit2 = await prisma.unit.create({ data: { name: name('unit2'), workspaceId } });
  const conversion = await prisma.unitConversion.create({ data: { fromUnitId: unit.id, toUnitId: unit2.id, factor: 10, workspaceId } });
  const ice = await prisma.ice.create({ data: { name: name('ice'), workspaceId } });
  const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: name('action'), actionGroup: 'MIXING', workspaceId } });
  const glass = await prisma.glass.create({ data: { name: name('glass'), deposit: 1, workspaceId, GlassImage: { create: { image } } } });
  const garnish = await prisma.garnish.create({ data: { name: name('garnish'), workspaceId, GarnishImage: { create: { image } } } });
  const ingredient = await prisma.ingredient.create({
    data: {
      name: name('ingredient'),
      workspaceId,
      IngredientImage: { create: { image } },
      IngredientVolume: { create: { volume: 70, unitId: unit.id, workspaceId } },
    },
  });
  const cocktail = await prisma.cocktailRecipe.create({
    data: {
      name: name('cocktail'),
      description: name('description'),
      workspaceId,
      glassId: glass.id,
      iceId: ice.id,
      CocktailRecipeImage: { create: { image } },
      garnishes: { create: { garnishId: garnish.id, garnishNumber: 0 } },
      steps: {
        create: {
          stepNumber: 0,
          actionId: action.id,
          ingredients: { create: { ingredientNumber: 0, amount: 4, unitId: unit.id, ingredientId: ingredient.id } },
        },
      },
    },
  });
  const rating = await prisma.cocktailRating.create({ data: { cocktailId: cocktail.id, rating: 5, name: name('rater'), comment: name('comment') } });
  const card = await prisma.cocktailCard.create({
    data: { name: name('card'), workspaceId, groups: { create: { name: name('card group'), items: { create: { cocktailId: cocktail.id } } } } },
    include: { groups: true },
  });
  const calculationGroup = await prisma.cocktailCalculationGroup.create({ data: { name: name('calc group'), workspaceId } });
  const calculation = await prisma.cocktailCalculation.create({
    data: {
      name: name('calculation'),
      workspaceId,
      updatedByUserId: owner.user.id,
      groupId: calculationGroup.id,
      cocktailCalculationItems: { create: { cocktailId: cocktail.id, plannedAmount: 3 } },
      ingredientShoppingUnits: { create: { ingredientId: ingredient.id, unitId: unit.id } },
    },
  });
  const queueItem = await prisma.cocktailQueue.create({ data: { cocktailId: cocktail.id, workspaceId, notes: name('queue note') } });
  const statistic = await prisma.cocktailStatisticItem.create({
    data: { cocktailId: cocktail.id, workspaceId, date: new Date(), userId: member.user.id, cocktailCardId: card.id },
  });
  const savedSet = await prisma.statisticSavedSet.create({
    data: { name: name('saved set'), workspaceId, type: 'COCKTAIL_SET', logic: 'OR', items: [cocktail.id] as Prisma.InputJsonValue },
  });
  const tagCategory = await prisma.tagCategory.create({ data: { workspaceId, name: { de: name('tag category') } } });
  await prisma.tagDefinition.create({ data: { workspaceId, tag: name('tag'), categoryId: tagCategory.id } });
  const guestMenu = await prisma.guestMenu.create({
    data: {
      workspaceId,
      name: name('guest menu'),
      slug: `b-menu-${randomBytes(4).toString('hex')}`,
      draft: createDefaultGuestMenuDocument() as unknown as Prisma.InputJsonValue,
      published: createDefaultGuestMenuDocument() as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
  });
  const template = await prisma.guestMenuTemplate.create({ data: { workspaceId, name: name('template'), definition: {} } });
  await prisma.signage.create({ data: { workspaceId, format: 'PORTRAIT' } });
  const slide = await prisma.signageSlide.create({ data: { workspaceId, format: 'PORTRAIT', content: image, order: 0 } });
  const joinCode = await prisma.workspaceJoinCode.create({ data: { workspaceId, code: `bjoin${randomBytes(6).toString('hex')}` } });
  const applicant = await prisma.user.create({ data: { name: name('applicant'), email: `applicant-${randomBytes(4).toString('hex')}@test.local` } });
  await prisma.workspaceJoinRequest.create({ data: { workspaceId, userId: applicant.id } });
  const apiKey = await prisma.workspaceApiKey.create({
    data: { workspaceId, name: name('api key'), keyId: `bkey_${randomBytes(8).toString('hex')}`, createdByUserId: owner.user.id },
  });
  await prisma.workspaceSetting.create({
    data: { workspaceId, setting: 'translations', value: JSON.stringify({ de: { [name('key')]: name('translation') } }) },
  });

  return {
    marker,
    ids: {
      unitId: unit.id,
      unitConversionId: conversion.id,
      iceId: ice.id,
      actionId: action.id,
      glassId: glass.id,
      garnishId: garnish.id,
      ingredientId: ingredient.id,
      cocktailId: cocktail.id,
      ratingId: rating.id,
      cardId: card.id,
      cardGroupId: card.groups[0]!.id,
      groupId: calculationGroup.id,
      calculationId: calculation.id,
      queueItemId: queueItem.id,
      cocktailStatisticId: statistic.id,
      setId: savedSet.id,
      categoryId: tagCategory.id,
      menuId: guestMenu.id,
      templateId: template.id,
      slideId: slide.id,
      code: joinCode.code,
      userId: member.user.id,
      applicantUserId: applicant.id,
      keyId: apiKey.id,
    },
  };
}

/**
 * Fingerprint of every application table (except volatile auth bookkeeping).
 * Two equal fingerprints mean no row was inserted, changed or deleted.
 */
export async function databaseFingerprint(): Promise<string> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'session', 'Session', 'verification', 'Verification')
    ORDER BY tablename
  `;
  const parts = tables.map(
    ({ tablename }) =>
      `(SELECT '${tablename}:' || count(*) || ':' || coalesce(md5(string_agg(md5(t::text), '' ORDER BY md5(t::text))), '') FROM "${tablename}" t)`,
  );
  const [row] = await prisma.$queryRawUnsafe<Array<{ fp: string }>>(`SELECT concat_ws('|', ${parts.join(', ')}) AS fp`);
  return row!.fp;
}
