import { SignageSlideView } from './types';

export interface SlideScheduleFields {
  enabled: boolean;
  weekdays: number[];
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  dateExclusive?: boolean;
}

function toDateOnly(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSlideActiveNow(slide: SlideScheduleFields, referenceDate: Date = new Date()): boolean {
  if (!slide.enabled) {
    return false;
  }

  if (slide.weekdays.length > 0 && !slide.weekdays.includes(referenceDate.getDay())) {
    return false;
  }

  const today = toDateOnly(referenceDate);

  if (slide.validFrom) {
    const from = toDateOnly(slide.validFrom);
    if (today.getTime() < from.getTime()) {
      return false;
    }
  }

  if (slide.validTo) {
    const to = toDateOnly(slide.validTo);
    if (today.getTime() > to.getTime()) {
      return false;
    }
  }

  return true;
}

export function filterSlidesForDisplay<T extends SignageSlideView>(slides: T[], referenceDate: Date = new Date()): T[] {
  const activeSlides = slides.filter((slide) => isSlideActiveNow(slide, referenceDate));
  const exclusiveSlides = activeSlides.filter((slide) => slide.dateExclusive);

  if (exclusiveSlides.length > 0) {
    return exclusiveSlides;
  }

  return activeSlides;
}

export function formatSlideScheduleLabel(slide: SlideScheduleFields): string {
  const parts: string[] = [];

  if (!slide.enabled) {
    parts.push('Deaktiviert');
  }

  if (slide.dateExclusive) {
    parts.push('Exklusiv');
  }

  if (slide.weekdays.length > 0) {
    const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    parts.push(slide.weekdays.map((day) => dayLabels[day]).join(', '));
  } else {
    parts.push('Alle Wochentage');
  }

  if (slide.validFrom || slide.validTo) {
    const from = slide.validFrom ? toDateOnly(slide.validFrom).toLocaleDateString('de-DE') : '…';
    const to = slide.validTo ? toDateOnly(slide.validTo).toLocaleDateString('de-DE') : '…';
    parts.push(`${from} – ${to}`);
  }

  return parts.join(' · ');
}
