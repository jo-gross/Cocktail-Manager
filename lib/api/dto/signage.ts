/**
 * Prisma → public DTO mapping for Monitor/Signage. Slides expose `imageUrl`
 * (a bytes endpoint) instead of the raw base64 `content`; dates are YYYY-MM-DD.
 */
import type { Signage, SignageSlide } from '@generated/prisma/client';
import type { SignageFormatDto, SignageSlideDto } from '@lib/schemas/signage';

function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function toSignageSlideDto(slide: SignageSlide, workspaceId: string): SignageSlideDto {
  return {
    id: slide.id,
    order: slide.order,
    enabled: slide.enabled,
    weekdays: slide.weekdays,
    validFrom: toDateOnly(slide.validFrom),
    validTo: toDateOnly(slide.validTo),
    dateExclusive: slide.dateExclusive,
    imageUrl: `/api/v1/workspaces/${workspaceId}/admin/signage/slides/${slide.id}/image`,
  };
}

export function toSignageFormatDto(signage: Signage, slides: SignageSlide[], workspaceId: string): SignageFormatDto {
  return {
    format: signage.format,
    backgroundColor: signage.backgroundColor,
    backgroundMode: signage.backgroundMode,
    slideDurationSeconds: signage.slideDurationSeconds,
    mirrorSourceFormat: signage.mirrorSourceFormat,
    slides: slides.map((slide) => toSignageSlideDto(slide, workspaceId)),
  };
}
