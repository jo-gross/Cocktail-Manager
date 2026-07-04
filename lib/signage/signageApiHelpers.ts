import { $Enums } from '@generated/prisma/client';
import { SignageFormatView, SignageSlideView } from './types';

type MonitorFormat = $Enums.MonitorFormat;

export function mapSignageSlide(slide: {
  id: string;
  content: string;
  order: number;
  enabled: boolean;
  weekdays: number[];
  validFrom: Date | null;
  validTo: Date | null;
  dateExclusive: boolean;
}): SignageSlideView {
  return {
    id: slide.id,
    content: slide.content,
    order: slide.order,
    enabled: slide.enabled,
    weekdays: slide.weekdays,
    validFrom: slide.validFrom ? slide.validFrom.toISOString().slice(0, 10) : null,
    validTo: slide.validTo ? slide.validTo.toISOString().slice(0, 10) : null,
    dateExclusive: slide.dateExclusive,
  };
}

export async function ensureSignageContainer(
  tx: {
    signage: {
      findUnique: (args: { where: { workspaceId_format: { workspaceId: string; format: MonitorFormat } } }) => Promise<unknown>;
      create: (args: { data: { workspaceId: string; format: MonitorFormat; slideDurationSeconds: number } }) => Promise<unknown>;
    };
  },
  workspaceId: string,
  format: MonitorFormat,
) {
  const existing = await tx.signage.findUnique({
    where: {
      workspaceId_format: {
        workspaceId,
        format,
      },
    },
  });

  if (!existing) {
    await tx.signage.create({
      data: {
        workspaceId,
        format,
        slideDurationSeconds: 10,
      },
    });
  }
}

export function resolveSignageSlides(
  signages: Array<{
    format: MonitorFormat | 'LANDSCAPE' | 'PORTRAIT';
    mirrorSourceFormat?: MonitorFormat | 'LANDSCAPE' | 'PORTRAIT' | null;
    slides: SignageSlideView[];
  }>,
  format: MonitorFormat | 'LANDSCAPE' | 'PORTRAIT',
): SignageSlideView[] {
  const signage = signages.find((entry) => entry.format === format);
  if (!signage) {
    return [];
  }

  if (signage.mirrorSourceFormat) {
    const source = signages.find((entry) => entry.format === signage.mirrorSourceFormat);
    return source?.slides ?? [];
  }

  return signage.slides;
}

export function mapSignageFormatView(signage: {
  workspaceId: string;
  format: MonitorFormat;
  backgroundColor: string | null;
  backgroundMode?: 'COLOR' | 'BLURRED';
  slideDurationSeconds: number;
  mirrorSourceFormat: MonitorFormat | null;
  slides: SignageSlideView[];
}): SignageFormatView {
  return {
    workspaceId: signage.workspaceId,
    format: signage.format,
    backgroundColor: signage.backgroundColor,
    backgroundMode: signage.backgroundMode ?? 'COLOR',
    slideDurationSeconds: signage.slideDurationSeconds,
    mirrorSourceFormat: signage.mirrorSourceFormat,
    slides: signage.slides,
  };
}
