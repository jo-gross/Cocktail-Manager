/**
 * Constants and helpers for day-related operations
 */

// Day names in German (full names)
export const DAY_NAMES_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;

// Day names in German (short, starting with Sunday)
export const DAY_NAMES_SHORT_SUNDAY_FIRST = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

// Day names in German (short, starting with Monday)
export const DAY_NAMES_SHORT_MONDAY_FIRST = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

// Day order mapping: API returns 0=Sunday, 1=Monday, ..., 6=Saturday
// This array maps display order (Monday first) to API day numbers
export const DAY_ORDER_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Get day name by API day number (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param day API day number (0-6)
 * @param short Use short name
 * @param mondayFirst Start week with Monday
 */
export function getDayName(day: number, short: boolean = true, mondayFirst: boolean = true): string {
  if (mondayFirst) {
    const index = DAY_ORDER_MONDAY_FIRST.indexOf(day as any);
    if (index === -1) return '';
    return short ? DAY_NAMES_SHORT_MONDAY_FIRST[index] : DAY_NAMES_FULL[day];
  } else {
    return short ? DAY_NAMES_SHORT_SUNDAY_FIRST[day] : DAY_NAMES_FULL[day];
  }
}

/**
 * Reorder day distribution data to start with Monday
 * @param dayDistribution Array of { day: number, count?: number } where day is 0-6 (0=Sunday)
 * @returns Array reordered to start with Monday
 */
export function reorderDaysMondayFirst<T extends { day: number; count?: number }>(dayDistribution: T[]): T[] {
  return DAY_ORDER_MONDAY_FIRST.map((apiDay) => {
    const dist = dayDistribution.find((d) => d.day === apiDay);
    if (dist) return dist;
    // Create default entry with same structure as input
    return { day: apiDay, count: 0 } as T;
  });
}
