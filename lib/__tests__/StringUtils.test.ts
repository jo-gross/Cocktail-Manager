import { describe, it, expect } from 'vitest';
import { normalizeString } from '../StringUtils';

describe('StringUtils', () => {
  describe('normalizeString', () => {
    it('should return empty string for undefined', () => {
      expect(normalizeString(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeString('  hello  ')).toBe('hello');
    });

    it('should convert to lowercase', () => {
      expect(normalizeString('Hello World')).toBe('hello world');
    });

    it('should remove diacritics', () => {
      expect(normalizeString('Créme Brûlée')).toBe('creme brulee');
    });

    it('should handle combined transformations', () => {
      expect(normalizeString('  Ölé  ')).toBe('ole');
    });

    it('should handle empty string', () => {
      expect(normalizeString('')).toBe('');
    });

    it('should handle German umlauts', () => {
      expect(normalizeString('Über')).toBe('uber');
    });
  });
});
