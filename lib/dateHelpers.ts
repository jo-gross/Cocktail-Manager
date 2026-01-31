/**
 * Date helper functions for statistics and time range calculations
 */

/**
 * Parse a time string (HH:mm) into hours and minutes
 */
export function parseTimeString(timeString: string | undefined | null): { hours: number; minutes: number } {
  if (!timeString || typeof timeString !== 'string') {
    return { hours: 0, minutes: 0 };
  }
  const [hours, minutes] = timeString.split(':').map((v) => parseInt(v, 10) || 0);
  return { hours, minutes };
}

/**
 * Get the start of a day, optionally with a custom day start time
 * If the current time is before dayStartTime, the "day" is considered to be the previous calendar day
 * @param date The reference date
 * @param dayStartTime Optional time string (HH:mm) when a day starts (e.g., "18:00" for bar business)
 */
export function getStartOfDay(date: Date, dayStartTime?: string): Date {
  const { hours, minutes } = parseTimeString(dayStartTime);
  // First, get the logical date (accounts for times before dayStartTime)
  const logicalDate = getLogicalDate(date, dayStartTime);
  const d = new Date(logicalDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Get the end of a day, optionally with a custom day start time
 * If the current time is before dayStartTime, the "day" is considered to be the previous calendar day
 * @param date The reference date
 * @param dayStartTime Optional time string (HH:mm) when a day starts
 */
export function getEndOfDay(date: Date, dayStartTime?: string): Date {
  const { hours, minutes } = parseTimeString(dayStartTime);
  // First, get the logical date (accounts for times before dayStartTime)
  const logicalDate = getLogicalDate(date, dayStartTime);
  const d = new Date(logicalDate);
  // End of day is one day later minus 1 millisecond from the start time
  d.setDate(d.getDate() + 1);
  d.setHours(hours, minutes, 0, 0);
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d;
}

/**
 * Format a date as YYYY-MM-DD using local date components (not UTC).
 * Use this for grouping keys so the day matches getLogicalDate/getStartOfDay logic.
 */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the logical day for a given date based on the day start time
 * If current time is before dayStartTime, it belongs to the previous day
 * @param date The reference date
 * @param dayStartTime Optional time string (HH:mm) when a day starts
 */
export function getLogicalDate(date: Date, dayStartTime?: string): Date {
  const { hours, minutes } = parseTimeString(dayStartTime);
  const d = new Date(date);

  // If the time is before the day start, it belongs to the previous logical day
  const currentMinutes = d.getHours() * 60 + d.getMinutes();
  const dayStartMinutes = hours * 60 + minutes;

  if (currentMinutes < dayStartMinutes && dayStartMinutes > 0) {
    d.setDate(d.getDate() - 1);
  }

  return d;
}

export function getStartOfWeek(date: Date, dayStartTime?: string): Date {
  // First, get the logical date to determine which calendar day we're in
  const logicalDate = getLogicalDate(date, dayStartTime);
  const d = new Date(logicalDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  // Set the time to the day start time
  const { hours, minutes } = parseTimeString(dayStartTime);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function getStartOfMonth(date: Date, dayStartTime?: string): Date {
  // First, get the logical date to determine which calendar day we're in
  const logicalDate = getLogicalDate(date, dayStartTime);
  const d = new Date(logicalDate);
  d.setDate(1);
  // Set the time to the day start time
  const { hours, minutes } = parseTimeString(dayStartTime);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function getStartOfYear(date: Date, dayStartTime?: string): Date {
  // First, get the logical date to determine which calendar day we're in
  const logicalDate = getLogicalDate(date, dayStartTime);
  const d = new Date(logicalDate);
  d.setMonth(0, 1);
  // Set the time to the day start time
  const { hours, minutes } = parseTimeString(dayStartTime);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Format a time range for display including time
 */
export function formatTimeRangeWithTime(timeRange: { startDate: Date; endDate: Date }): string {
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return `${formatDateTime(timeRange.startDate)} - ${formatDateTime(timeRange.endDate)}`;
}

/**
 * Get an array of hour labels ordered starting from the day start hour
 * @param dayStartTime Optional time string (HH:mm) when a day starts
 * @returns Array of 24 hour labels starting from the day start hour
 */
export function getOrderedHourLabels(dayStartTime?: string): string[] {
  const { hours: startHour } = parseTimeString(dayStartTime);
  const labels: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    labels.push(`${hour}:00`);
  }
  return labels;
}

/**
 * Get the ordered hours array starting from the day start hour
 * @param dayStartTime Optional time string (HH:mm) when a day starts
 * @returns Array of 24 hours starting from the day start hour
 */
export function getOrderedHours(dayStartTime?: string): number[] {
  const { hours: startHour } = parseTimeString(dayStartTime);
  const hours: number[] = [];
  for (let i = 0; i < 24; i++) {
    hours.push((startHour + i) % 24);
  }
  return hours;
}

/**
 * Reorder hour distribution data to start from the day start hour
 * @param hourDistribution Array of { hour: number, count: number }
 * @param dayStartTime Optional time string (HH:mm) when a day starts
 * @returns Reordered array starting from the day start hour
 */
export function reorderHourDistribution<T extends { hour: number; count?: number }>(hourDistribution: T[], dayStartTime?: string): T[] {
  const orderedHours = getOrderedHours(dayStartTime);
  return orderedHours.map((hour) => {
    const existing = hourDistribution.find((d) => d.hour === hour);
    return existing || ({ hour, count: 0 } as T);
  });
}
