/**
 * Business logic for Monitor/Signage (v1): mirror-format settings, slide
 * order and exclusive-overlap validation. Returns clean DTOs.
 *
 * Every write that depends on the slides of a workspace (append order,
 * overlap check, order changes) runs in one transaction behind the
 * `signage-slides` workspace lock.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';
import { decodeStoredImage, type DecodedImage } from '@lib/images/imageResponse';
import { ensureSignageContainer } from '@lib/signage/signageApiHelpers';
import { validateExclusiveOverlap } from '@lib/signage/validateExclusiveOverlap';
import { buildSignagePath, generateSignageKey } from '@lib/signage/signageKey';
import { toSignageFormatDto, toSignageSlideDto } from '@lib/api/dto/signage';
import { Prisma, type Workspace } from '@generated/prisma/client';
import type {
  SignageFormatDto,
  SignageFormatSettingsInput,
  SignageGuestMenuSlideCreateInput,
  SignageGuestMenuSlideUpdateInput,
  SignageKeyDto,
  SignageSettingsUpdateInput,
  SignageSlideCreateInput,
  SignageSlideDto,
  SignageSlidePatchInput,
} from '@lib/schemas/signage';

type MonitorFormat = 'LANDSCAPE' | 'PORTRAIT';

const slideInclude = { guestMenu: { select: { name: true } } } as const;

const SLIDES_LOCK = 'signage-slides';

async function updateSignageFormatSettings(tx: Tx, workspaceId: string, format: MonitorFormat, data: SignageFormatSettingsInput | undefined) {
  if (!data) return;

  const existing = await tx.signage.findUnique({ where: { workspaceId_format: { workspaceId, format } } });
  const mirrorSourceFormat = data.mirrorSourceFormat ?? null;

  const signageData = {
    slideDurationSeconds: data.slideDurationSeconds,
    backgroundColor: data.backgroundColor === '' || data.backgroundColor === null ? null : (data.backgroundColor ?? null),
    backgroundMode: data.backgroundMode ?? 'COLOR',
    mirrorSourceFormat,
  };

  if (existing || data.slides.length > 0 || mirrorSourceFormat) {
    await tx.signage.upsert({
      where: { workspaceId_format: { workspaceId, format } },
      update: signageData,
      create: { workspaceId, format, ...signageData },
    });
  }

  if (mirrorSourceFormat) {
    await tx.signageSlide.updateMany({ where: { workspaceId, format }, data: { enabled: false } });
  } else if (existing?.mirrorSourceFormat) {
    const formatSlides = await tx.signageSlide.findMany({ where: { workspaceId, format } });
    if (formatSlides.length === 1 && !formatSlides[0].enabled) {
      await tx.signageSlide.update({ where: { id: formatSlides[0].id }, data: { enabled: true } });
    }
  }

  // Sequential on purpose (no Promise.all on a transaction client); foreign ids match nothing.
  for (const slide of data.slides) {
    await tx.signageSlide.updateMany({ where: { id: slide.id, workspaceId, format }, data: { order: slide.order } });
  }
}

async function nextSlideOrder(tx: Tx, workspaceId: string, format: MonitorFormat): Promise<number> {
  const max = await tx.signageSlide.aggregate({ where: { workspaceId, format }, _max: { order: true } });
  return (max._max.order ?? -1) + 1;
}

export async function getSignage(workspace: Workspace): Promise<SignageFormatDto[]> {
  const [signages, slides] = await Promise.all([
    prisma.signage.findMany({ where: { workspaceId: workspace.id } }),
    prisma.signageSlide.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: 'asc' }, include: slideInclude }),
  ]);
  return signages.map((signage) =>
    toSignageFormatDto(
      signage,
      slides.filter((slide) => slide.format === signage.format),
      workspace.id,
    ),
  );
}

export async function updateSignage(workspace: Workspace, input: SignageSettingsUpdateInput): Promise<SignageFormatDto[]> {
  await runTx(async (tx) => {
    await lockWorkspaceScope(tx, workspace.id, SLIDES_LOCK);
    await updateSignageFormatSettings(tx, workspace.id, 'LANDSCAPE', input.landscape);
    await updateSignageFormatSettings(tx, workspace.id, 'PORTRAIT', input.portrait);
  });
  return getSignage(workspace);
}

export async function createSlides(workspace: Workspace, input: SignageSlideCreateInput): Promise<SignageSlideDto[]> {
  const format = input.format;
  const created = await runTx(async (tx) => {
    await lockWorkspaceScope(tx, workspace.id, SLIDES_LOCK);
    await ensureSignageContainer(tx, workspace.id, format);

    let order = await nextSlideOrder(tx, workspace.id, format);
    const slides = [];
    for (const content of input.slides) {
      slides.push(await tx.signageSlide.create({ data: { workspaceId: workspace.id, format, content, order }, include: slideInclude }));
      order += 1;
    }
    return slides;
  });

  return created.map((slide) => toSignageSlideDto(slide, workspace.id));
}

export async function patchSlides(workspace: Workspace, input: SignageSlidePatchInput): Promise<SignageSlideDto[]> {
  const data: { enabled?: boolean; weekdays?: number[]; validFrom?: Date | null; validTo?: Date | null; dateExclusive?: boolean } = {};
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.weekdays !== undefined) data.weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  if (input.validFrom !== undefined) data.validFrom = input.validFrom ? new Date(input.validFrom) : null;
  if (input.validTo !== undefined) data.validTo = input.validTo ? new Date(input.validTo) : null;
  if (input.dateExclusive !== undefined) data.dateExclusive = input.dateExclusive;
  if (Object.keys(data).length === 0) throw new ApiError(400, 'NO_UPDATE_FIELDS', 'No update fields provided');

  const slideIds = [...new Set(input.slideIds)];
  const scheduleFieldsChanging =
    input.dateExclusive !== undefined || input.validFrom !== undefined || input.validTo !== undefined || input.enabled !== undefined;

  await runTx(async (tx) => {
    await lockWorkspaceScope(tx, workspace.id, SLIDES_LOCK);

    const existingSlides = await tx.signageSlide.findMany({ where: { workspaceId: workspace.id, id: { in: slideIds } }, select: { id: true, format: true } });
    if (existingSlides.length !== slideIds.length) throw new ApiError(404, 'SLIDES_NOT_FOUND', 'Slides not found');

    if (scheduleFieldsChanging) {
      // Exclusive ranges may only overlap within a format; check every format the patch touches.
      for (const format of new Set(existingSlides.map((slide) => slide.format))) {
        const formatSlides = await tx.signageSlide.findMany({
          where: { workspaceId: workspace.id, format },
          select: { id: true, dateExclusive: true, enabled: true, validFrom: true, validTo: true, weekdays: true },
        });
        const validation = validateExclusiveOverlap(formatSlides, slideIds, {
          dateExclusive: input.dateExclusive,
          enabled: input.enabled,
          validFrom: input.validFrom,
          validTo: input.validTo,
        });
        if (!validation.valid) {
          throw new ApiError(409, 'EXCLUSIVE_OVERLAP', 'Exclusive time ranges overlap with existing exclusive cards', { conflicts: validation.conflicts });
        }
      }
    }

    await tx.signageSlide.updateMany({ where: { workspaceId: workspace.id, id: { in: slideIds } }, data });
  });

  const slides = await prisma.signageSlide.findMany({
    where: { workspaceId: workspace.id, id: { in: slideIds } },
    orderBy: { order: 'asc' },
    include: slideInclude,
  });
  return slides.map((slide) => toSignageSlideDto(slide, workspace.id));
}

async function assertGuestMenuInWorkspace(tx: Tx, workspaceId: string, guestMenuId: string | null | undefined) {
  if (!guestMenuId) return;
  const menu = await tx.guestMenu.findFirst({ where: { id: guestMenuId, workspaceId }, select: { id: true } });
  if (!menu) throw new ApiError(404, 'GUEST_MENU_NOT_FOUND', 'Guest menu not found');
}

function toOptionsJson(options: SignageGuestMenuSlideCreateInput['options']) {
  if (!options) return Prisma.DbNull;
  // Drop unset values so the stored JSON only contains real overrides.
  const entries = Object.entries(options).filter(([, value]) => value !== undefined && value !== null);
  return entries.length > 0 ? (Object.fromEntries(entries) as Prisma.InputJsonObject) : Prisma.DbNull;
}

export async function createGuestMenuSlide(workspace: Workspace, input: SignageGuestMenuSlideCreateInput): Promise<SignageSlideDto> {
  const slide = await runTx(async (tx) => {
    await assertGuestMenuInWorkspace(tx, workspace.id, input.guestMenuId);
    await lockWorkspaceScope(tx, workspace.id, SLIDES_LOCK);
    await ensureSignageContainer(tx, workspace.id, input.format);
    return tx.signageSlide.create({
      data: {
        workspaceId: workspace.id,
        format: input.format,
        type: 'GUEST_MENU',
        content: '',
        guestMenuId: input.guestMenuId ?? null,
        options: toOptionsJson(input.options),
        order: await nextSlideOrder(tx, workspace.id, input.format),
      },
      include: slideInclude,
    });
  });
  return toSignageSlideDto(slide, workspace.id);
}

export async function updateGuestMenuSlide(workspace: Workspace, slideId: string, input: SignageGuestMenuSlideUpdateInput): Promise<SignageSlideDto> {
  const data: Prisma.SignageSlideUncheckedUpdateInput = {};
  if (input.guestMenuId !== undefined) data.guestMenuId = input.guestMenuId;
  if (input.options !== undefined) data.options = toOptionsJson(input.options);

  const slide = await runTx(async (tx) => {
    const existing = await tx.signageSlide.findFirst({ where: { id: slideId, workspaceId: workspace.id }, select: { type: true } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Slide not found');
    if (existing.type !== 'GUEST_MENU') throw new ApiError(400, 'NOT_A_GUEST_MENU_SLIDE', 'Slide is not a guest menu slide');
    await assertGuestMenuInWorkspace(tx, workspace.id, input.guestMenuId);
    return tx.signageSlide.update({ where: { id: slideId, workspaceId: workspace.id }, data, include: slideInclude });
  });
  return toSignageSlideDto(slide, workspace.id);
}

export async function deleteSlide(workspace: Workspace, slideId: string): Promise<{ count: number }> {
  const result = await prisma.signageSlide.deleteMany({ where: { id: slideId, workspaceId: workspace.id } });
  if (result.count === 0) throw new ApiError(404, 'NOT_FOUND', 'Slide not found');
  return { count: result.count };
}

/** Image of an IMAGE slide; legacy rows hold bare base64 (served as PNG). Anything that is no image → null. */
export async function getSlideImage(workspace: Workspace, slideId: string): Promise<DecodedImage | null> {
  const slide = await prisma.signageSlide.findFirst({
    where: { id: slideId, workspaceId: workspace.id },
    select: { content: true, type: true },
  });
  if (!slide?.content || slide.type !== 'IMAGE') return null;
  return decodeStoredImage(slide.content.startsWith('data:') ? slide.content : `data:image/png;base64,${slide.content}`);
}

function toSignageKeyDto(workspaceId: string, key: string | null): SignageKeyDto {
  return { key, monitorPath: buildSignagePath(workspaceId, key) };
}

export async function getSignageKey(workspace: Workspace): Promise<SignageKeyDto> {
  const row = await prisma.workspace.findUnique({ where: { id: workspace.id }, select: { signageKey: true } });
  return toSignageKeyDto(workspace.id, row?.signageKey ?? null);
}

export async function regenerateSignageKey(workspace: Workspace): Promise<SignageKeyDto> {
  const key = generateSignageKey();
  await prisma.workspace.update({ where: { id: workspace.id }, data: { signageKey: key } });
  return toSignageKeyDto(workspace.id, key);
}
