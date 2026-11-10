/**
 * Prisma → public DTO mapping for Monitor/Signage. Slides expose `imageUrl`
 * (a bytes endpoint) instead of the raw base64 `content`; dates are YYYY-MM-DD.
 */
import type { Signage, SignageSlide } from '@generated/prisma/client';
import { GuestMenuSlideOptionsSchema, type GuestMenuSlideOptionsInput, type SignageFormatDto, type SignageSlideDto } from '@lib/schemas/signage';

export type SignageSlideWithMenu = SignageSlide & { guestMenu?: { name: string } | null };

function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Stored `options` JSON → validated options (invalid/unknown values are dropped). */
export function parseGuestMenuSlideOptions(value: unknown): GuestMenuSlideOptionsInput | null {
  if (value == null || typeof value !== 'object') return null;
  const parsed = GuestMenuSlideOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toSignageSlideDto(slide: SignageSlideWithMenu, workspaceId: string): SignageSlideDto {
  const isMenu = slide.type === 'GUEST_MENU';
  return {
    id: slide.id,
    order: slide.order,
    enabled: slide.enabled,
    weekdays: slide.weekdays,
    validFrom: toDateOnly(slide.validFrom),
    validTo: toDateOnly(slide.validTo),
    dateExclusive: slide.dateExclusive,
    type: slide.type,
    imageUrl: isMenu ? null : `/api/v1/workspaces/${workspaceId}/admin/signage/slides/${slide.id}/image`,
    guestMenuId: isMenu ? slide.guestMenuId : null,
    guestMenuName: isMenu ? (slide.guestMenu?.name ?? null) : null,
    options: isMenu ? parseGuestMenuSlideOptions(slide.options) : null,
  };
}

export function toSignageFormatDto(signage: Signage, slides: SignageSlideWithMenu[], workspaceId: string): SignageFormatDto {
  return {
    format: signage.format,
    backgroundColor: signage.backgroundColor,
    backgroundMode: signage.backgroundMode,
    slideDurationSeconds: signage.slideDurationSeconds,
    mirrorSourceFormat: signage.mirrorSourceFormat,
    slides: slides.map((slide) => toSignageSlideDto(slide, workspaceId)),
  };
}
