/**
 * Fixtures for guest menu and signage tests.
 */
import { randomBytes } from 'node:crypto';
import prisma from '../../../prisma/prisma';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import type { Prisma } from '@generated/prisma/client';

/** 1×1 transparent PNG. */
export const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function suffix(): string {
  return randomBytes(4).toString('hex');
}

export function seedGuestMenu(
  workspaceId: string,
  overrides: { name?: string; slug?: string; priority?: number; isDefault?: boolean; published?: boolean; accessCodeHash?: string | null } = {},
) {
  const document = createDefaultGuestMenuDocument({ title: overrides.name ?? 'Karte' }) as unknown as Prisma.InputJsonValue;
  return prisma.guestMenu.create({
    data: {
      workspaceId,
      name: overrides.name ?? `menu-${suffix()}`,
      slug: overrides.slug ?? `menu-${suffix()}`,
      priority: overrides.priority ?? 0,
      isDefault: overrides.isDefault ?? false,
      draft: document,
      ...(overrides.published ? { published: document, publishedAt: new Date() } : {}),
      accessCodeHash: overrides.accessCodeHash ?? null,
    },
  });
}

export function seedGuestMenuTemplate(workspaceId: string, name = `template-${suffix()}`) {
  return prisma.guestMenuTemplate.create({
    data: { workspaceId, name, definition: { schemaVersion: 1, baseTemplateId: 'classic', slots: {} } },
  });
}

export function seedCard(workspaceId: string, name = `card-${suffix()}`) {
  return prisma.cocktailCard.create({ data: { workspaceId, name } });
}

export async function seedSlide(
  workspaceId: string,
  overrides: {
    format?: 'LANDSCAPE' | 'PORTRAIT';
    order?: number;
    enabled?: boolean;
    content?: string;
    type?: 'IMAGE' | 'GUEST_MENU';
    guestMenuId?: string | null;
    validFrom?: Date | null;
    validTo?: Date | null;
    dateExclusive?: boolean;
  } = {},
) {
  const format = overrides.format ?? 'LANDSCAPE';
  await prisma.signage.createMany({ data: [{ workspaceId, format }], skipDuplicates: true });
  return prisma.signageSlide.create({
    data: {
      workspaceId,
      format,
      order: overrides.order ?? 0,
      enabled: overrides.enabled ?? true,
      type: overrides.type ?? 'IMAGE',
      content: overrides.content ?? (overrides.type === 'GUEST_MENU' ? '' : PNG_DATA_URI),
      guestMenuId: overrides.guestMenuId ?? null,
      validFrom: overrides.validFrom ?? null,
      validTo: overrides.validTo ?? null,
      dateExclusive: overrides.dateExclusive ?? false,
      weekdays: [],
    },
  });
}

/** Comparable snapshot of a row (dates as ISO strings). */
export async function snapshotGuestMenu(id: string) {
  return JSON.parse(JSON.stringify(await prisma.guestMenu.findUnique({ where: { id } })));
}

export async function snapshotSlide(id: string) {
  return JSON.parse(JSON.stringify(await prisma.signageSlide.findUnique({ where: { id } })));
}
