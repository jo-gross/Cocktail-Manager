/**
 * Version-agnostic business logic for Monitor/Signage (v1). Faithfully mirrors
 * the legacy handlers' DB logic (incl. the mirror-format settings behaviour and
 * exclusive-overlap validation) but returns clean DTOs. Legacy stays untouched.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { ensureSignageContainer } from '@lib/signage/signageApiHelpers';
import { validateExclusiveOverlap } from '@lib/signage/validateExclusiveOverlap';
import { toSignageFormatDto, toSignageSlideDto } from '@lib/api/dto/signage';
import type { Workspace } from '@generated/prisma/client';
import type {
  SignageFormatDto,
  SignageFormatSettingsInput,
  SignageSettingsUpdateInput,
  SignageSlideCreateInput,
  SignageSlideDto,
  SignageSlidePatchInput,
} from '@lib/schemas/signage';

type MonitorFormat = 'LANDSCAPE' | 'PORTRAIT';

// Copied verbatim from the legacy admin/signage handler (behaviour preserved).
async function updateSignageFormatSettings(workspaceId: string, format: MonitorFormat, data: SignageFormatSettingsInput | undefined) {
  if (!data) return;

  const existing = await prisma.signage.findUnique({ where: { workspaceId_format: { workspaceId, format } } });
  const mirrorSourceFormat = data.mirrorSourceFormat ?? null;

  const signageData = {
    slideDurationSeconds: data.slideDurationSeconds,
    backgroundColor: data.backgroundColor === '' || data.backgroundColor === null ? null : (data.backgroundColor ?? null),
    backgroundMode: data.backgroundMode ?? 'COLOR',
    mirrorSourceFormat,
  };

  if (existing || data.slides.length > 0 || mirrorSourceFormat) {
    await prisma.signage.upsert({
      where: { workspaceId_format: { workspaceId, format } },
      update: signageData,
      create: { workspaceId, format, ...signageData },
    });
  }

  if (mirrorSourceFormat) {
    await prisma.signageSlide.updateMany({ where: { workspaceId, format }, data: { enabled: false } });
  } else if (existing?.mirrorSourceFormat) {
    const formatSlides = await prisma.signageSlide.findMany({ where: { workspaceId, format } });
    if (formatSlides.length === 1 && !formatSlides[0].enabled) {
      await prisma.signageSlide.update({ where: { id: formatSlides[0].id }, data: { enabled: true } });
    }
  }

  await Promise.all(data.slides.map((slide) => prisma.signageSlide.updateMany({ where: { id: slide.id, workspaceId, format }, data: { order: slide.order } })));
}

export async function getSignage(workspace: Workspace): Promise<SignageFormatDto[]> {
  const [signages, slides] = await Promise.all([
    prisma.signage.findMany({ where: { workspaceId: workspace.id } }),
    prisma.signageSlide.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: 'asc' } }),
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
  await prisma.$transaction(async () => {
    if (input.landscape) await updateSignageFormatSettings(workspace.id, 'LANDSCAPE', input.landscape);
    if (input.portrait) await updateSignageFormatSettings(workspace.id, 'PORTRAIT', input.portrait);
  });
  return getSignage(workspace);
}

export async function createSlides(workspace: Workspace, input: SignageSlideCreateInput): Promise<SignageSlideDto[]> {
  const format = input.format;
  const created = await prisma.$transaction(async (tx) => {
    await ensureSignageContainer(tx, workspace.id, format);

    const maxOrderSlide = await tx.signageSlide.findFirst({
      where: { workspaceId: workspace.id, format },
      orderBy: { order: 'desc' },
    });

    let nextOrder = (maxOrderSlide?.order ?? -1) + 1;
    const slides = [];
    for (const content of input.slides) {
      slides.push(await tx.signageSlide.create({ data: { workspaceId: workspace.id, format, content, order: nextOrder } }));
      nextOrder += 1;
    }
    return slides;
  });

  return created.map((slide) => toSignageSlideDto(slide, workspace.id));
}

export async function patchSlides(workspace: Workspace, input: SignageSlidePatchInput): Promise<SignageSlideDto[]> {
  const existingSlides = await prisma.signageSlide.findMany({
    where: { workspaceId: workspace.id, id: { in: input.slideIds } },
  });
  if (existingSlides.length === 0) throw new ApiError(404, 'SLIDES_NOT_FOUND', 'Slides not found');

  const format = existingSlides[0].format;
  const allFormatSlides = await prisma.signageSlide.findMany({
    where: { workspaceId: workspace.id, format },
    orderBy: { order: 'asc' },
  });

  const scheduleFieldsChanging =
    input.dateExclusive !== undefined || input.validFrom !== undefined || input.validTo !== undefined || input.enabled !== undefined;

  if (scheduleFieldsChanging) {
    const validation = validateExclusiveOverlap(
      allFormatSlides.map((slide) => ({
        id: slide.id,
        dateExclusive: slide.dateExclusive,
        enabled: slide.enabled,
        validFrom: slide.validFrom,
        validTo: slide.validTo,
        weekdays: slide.weekdays,
      })),
      input.slideIds,
      { dateExclusive: input.dateExclusive, enabled: input.enabled, validFrom: input.validFrom, validTo: input.validTo },
    );

    if (!validation.valid) {
      throw new ApiError(409, 'EXCLUSIVE_OVERLAP', 'Exklusive Zeiträume überschneiden sich mit bestehenden exklusiven Karten', {
        conflicts: validation.conflicts,
      });
    }
  }

  const data: { enabled?: boolean; weekdays?: number[]; validFrom?: Date | null; validTo?: Date | null; dateExclusive?: boolean } = {};
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.weekdays !== undefined) data.weekdays = input.weekdays;
  if (input.validFrom !== undefined) data.validFrom = input.validFrom ? new Date(input.validFrom) : null;
  if (input.validTo !== undefined) data.validTo = input.validTo ? new Date(input.validTo) : null;
  if (input.dateExclusive !== undefined) data.dateExclusive = input.dateExclusive;

  if (Object.keys(data).length === 0) throw new ApiError(400, 'NO_UPDATE_FIELDS', 'No update fields provided');

  await prisma.signageSlide.updateMany({ where: { workspaceId: workspace.id, id: { in: input.slideIds } }, data });

  const slides = await prisma.signageSlide.findMany({
    where: { workspaceId: workspace.id, id: { in: input.slideIds } },
    orderBy: { order: 'asc' },
  });
  return slides.map((slide) => toSignageSlideDto(slide, workspace.id));
}

export async function deleteSlide(workspace: Workspace, slideId: string): Promise<{ count: number }> {
  const result = await prisma.signageSlide.deleteMany({ where: { id: slideId, workspaceId: workspace.id } });
  if (result.count === 0) throw new ApiError(404, 'NOT_FOUND', 'Slide not found');
  return { count: result.count };
}

export async function getSlideImage(workspace: Workspace, slideId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const slide = await prisma.signageSlide.findFirst({
    where: { id: slideId, workspaceId: workspace.id },
    select: { content: true },
  });
  if (!slide?.content) return null;

  const raw = slide.content;
  if (raw.startsWith('data:')) {
    const contentType = raw.split(';')[0].split(':')[1];
    return { contentType, bytes: Buffer.from(raw.split(',')[1], 'base64') };
  }
  return { contentType: 'image/png', bytes: Buffer.from(raw, 'base64') };
}
