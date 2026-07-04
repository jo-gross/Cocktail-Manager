import { formatSlideScheduleLabel } from './isSlideActiveNow';

export interface ExclusiveOverlapSlide {
  id: string;
  dateExclusive: boolean;
  enabled: boolean;
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  weekdays?: number[];
}

export interface ExclusiveOverlapUpdate {
  dateExclusive?: boolean;
  enabled?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface ExclusiveOverlapConflict {
  slideId: string;
  label: string;
}

function toDateOnly(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateRangesOverlap(
  fromA: string | Date | null | undefined,
  toA: string | Date | null | undefined,
  fromB: string | Date | null | undefined,
  toB: string | Date | null | undefined,
): boolean {
  const startA = fromA ? toDateOnly(fromA).getTime() : Number.NEGATIVE_INFINITY;
  const endA = toA ? toDateOnly(toA).getTime() : Number.POSITIVE_INFINITY;
  const startB = fromB ? toDateOnly(fromB).getTime() : Number.NEGATIVE_INFINITY;
  const endB = toB ? toDateOnly(toB).getTime() : Number.POSITIVE_INFINITY;

  return startA <= endB && startB <= endA;
}

function projectSlide(slide: ExclusiveOverlapSlide, update: ExclusiveOverlapUpdate, isAffected: boolean): ExclusiveOverlapSlide {
  if (!isAffected) {
    return slide;
  }

  return {
    ...slide,
    dateExclusive: update.dateExclusive ?? slide.dateExclusive,
    enabled: update.enabled ?? slide.enabled,
    validFrom: update.validFrom !== undefined ? update.validFrom : slide.validFrom,
    validTo: update.validTo !== undefined ? update.validTo : slide.validTo,
  };
}

export function validateExclusiveOverlap(
  allSlides: ExclusiveOverlapSlide[],
  affectedSlideIds: string[],
  update: ExclusiveOverlapUpdate,
): { valid: boolean; conflicts: ExclusiveOverlapConflict[] } {
  const affectedSet = new Set(affectedSlideIds);
  const projected = allSlides.map((slide) => projectSlide(slide, update, affectedSet.has(slide.id)));

  const exclusiveSlides = projected.filter((slide) => slide.dateExclusive && slide.enabled);
  const conflicts: ExclusiveOverlapConflict[] = [];
  const conflictIds = new Set<string>();

  for (let i = 0; i < exclusiveSlides.length; i += 1) {
    for (let j = i + 1; j < exclusiveSlides.length; j += 1) {
      const slideA = exclusiveSlides[i];
      const slideB = exclusiveSlides[j];

      if (!dateRangesOverlap(slideA.validFrom, slideA.validTo, slideB.validFrom, slideB.validTo)) {
        continue;
      }

      for (const slide of [slideA, slideB]) {
        if (!conflictIds.has(slide.id)) {
          conflictIds.add(slide.id);
          conflicts.push({
            slideId: slide.id,
            label: formatSlideScheduleLabel({ ...slide, weekdays: slide.weekdays ?? [] }),
          });
        }
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
