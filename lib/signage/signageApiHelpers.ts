import { $Enums } from '@generated/prisma/client';
import type { Db } from '@lib/db/tx';
import { GuestMenuSlideOptions, SignageFormatView, SignageSlideView } from './types';

type MonitorFormat = $Enums.MonitorFormat;

function toGuestMenuSlideOptions(value: unknown): GuestMenuSlideOptions | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as GuestMenuSlideOptions) : null;
}

export function mapSignageSlide(slide: {
  id: string;
  content: string;
  type?: 'IMAGE' | 'GUEST_MENU';
  guestMenuId?: string | null;
  guestMenu?: { slug: string } | null;
  options?: unknown;
  order: number;
  enabled: boolean;
  weekdays: number[];
  validFrom: Date | null;
  validTo: Date | null;
  dateExclusive: boolean;
}): SignageSlideView {
  const isMenu = slide.type === 'GUEST_MENU';
  return {
    id: slide.id,
    content: slide.content,
    type: slide.type ?? 'IMAGE',
    ...(isMenu
      ? { guestMenuId: slide.guestMenuId ?? null, guestMenuSlug: slide.guestMenu?.slug ?? null, options: toGuestMenuSlideOptions(slide.options) }
      : {}),
    order: slide.order,
    enabled: slide.enabled,
    weekdays: slide.weekdays,
    validFrom: slide.validFrom ? slide.validFrom.toISOString().slice(0, 10) : null,
    validTo: slide.validTo ? slide.validTo.toISOString().slice(0, 10) : null,
    dateExclusive: slide.dateExclusive,
  };
}

/**
 * Creates the per-format `Signage` row if missing. `INSERT … ON CONFLICT DO NOTHING`
 * (Prisma's upsert on the compound key is find-then-create and races).
 */
export async function ensureSignageContainer(db: Db, workspaceId: string, format: MonitorFormat) {
  await db.signage.createMany({ data: [{ workspaceId, format, slideDurationSeconds: 10 }], skipDuplicates: true });
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
