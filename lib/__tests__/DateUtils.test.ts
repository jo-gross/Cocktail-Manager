import { describe, it, expect } from 'vitest';
import { withoutTime, formatDateTime, formatDateTimeShort, formatDate, formatDateShort, formatDateNoYear, formatTime } from '../DateUtils';

describe('DateUtils', () => {
  const testDate = new Date(2025, 2, 15, 14, 30, 45); // March 15, 2025, 14:30:45

  describe('withoutTime', () => {
    it('should strip the time portion from a date', () => {
      const result = withoutTime(testDate);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date portion', () => {
      const result = withoutTime(testDate);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
    });

    it('should not mutate the original date', () => {
      const original = new Date(testDate);
      withoutTime(testDate);
      expect(testDate.getTime()).toBe(original.getTime());
    });
  });

  describe('formatDateTime', () => {
    it('should format date as dd.MM.yyyy HH:mm', () => {
      expect(formatDateTime(testDate)).toBe('15.03.2025 14:30');
    });

    it('should pad single-digit values', () => {
      const earlyDate = new Date(2025, 0, 5, 3, 7);
      expect(formatDateTime(earlyDate)).toBe('05.01.2025 03:07');
    });
  });

  describe('formatDateTimeShort', () => {
    it('should format date as dd.MM. HH:mm', () => {
      expect(formatDateTimeShort(testDate)).toBe('15.03. 14:30');
    });
  });

  describe('formatDate', () => {
    it('should format date as dd.MM.yyyy', () => {
      expect(formatDate(testDate)).toBe('15.03.2025');
    });
  });

  describe('formatDateShort', () => {
    it('should format date as dd.MM.yy', () => {
      expect(formatDateShort(testDate)).toBe('15.03.25');
    });

    it('should pad 2-digit year', () => {
      const earlyYearDate = new Date(2005, 5, 1);
      expect(formatDateShort(earlyYearDate)).toBe('01.06.05');
    });
  });

  describe('formatDateNoYear', () => {
    it('should format date as dd.MM.', () => {
      expect(formatDateNoYear(testDate)).toBe('15.03.');
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:mm', () => {
      expect(formatTime(testDate)).toBe('14:30');
    });

    it('should pad single-digit hours and minutes', () => {
      const earlyTime = new Date(2025, 0, 1, 8, 5);
      expect(formatTime(earlyTime)).toBe('08:05');
    });

    it('should handle midnight', () => {
      const midnight = new Date(2025, 0, 1, 0, 0);
      expect(formatTime(midnight)).toBe('00:00');
    });
  });
});
