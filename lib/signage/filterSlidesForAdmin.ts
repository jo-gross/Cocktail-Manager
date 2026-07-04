import { isSlideActiveNow } from './isSlideActiveNow';
import { SignageSlideFilterState, SignageSlideView } from './types';

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function rangesOverlap(slideFrom: string | null | undefined, slideTo: string | null | undefined, filterFrom: string, filterTo: string): boolean {
  const slideStart = slideFrom ? parseDate(slideFrom) : new Date(0);
  const slideEnd = slideTo ? parseDate(slideTo) : new Date(8640000000000000);
  const filterStart = parseDate(filterFrom);
  const filterEnd = parseDate(filterTo);

  return slideStart.getTime() <= filterEnd.getTime() && slideEnd.getTime() >= filterStart.getTime();
}

export function filterSlidesForAdmin(slides: SignageSlideView[], filter: SignageSlideFilterState, referenceDate: Date = new Date()): SignageSlideView[] {
  switch (filter.mode) {
    case 'activeNow':
      return slides.filter((slide) => isSlideActiveNow(slide, referenceDate));
    case 'weekday':
      if (filter.weekday === undefined) {
        return slides;
      }
      return slides.filter((slide) => slide.weekdays.length === 0 || slide.weekdays.includes(filter.weekday!));
    case 'dateRange':
      if (!filter.dateFrom || !filter.dateTo) {
        return slides;
      }
      return slides.filter((slide) => rangesOverlap(slide.validFrom, slide.validTo, filter.dateFrom!, filter.dateTo!));
    default:
      return slides;
  }
}
