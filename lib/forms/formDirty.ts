import _ from 'lodash';

const NUMERIC_STRING = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Normalizes form values for a "did the user change anything" comparison:
 * - `undefined`, `null`, `''`, `NaN`, empty arrays and empty objects are all treated as "no value",
 * - numeric strings (as produced by number inputs) equal the number they represent,
 * - object keys without a value are dropped (missing key = `undefined` = `null` = `''`),
 * - arrays stay order-sensitive, dates compare by timestamp, files by name/size/date.
 *
 * Strings are NOT trimmed – map the values to their submitted shape first (see `toComparable`
 * functions of the forms) and trim only where the form trims on submit.
 */
export function normalizeFormValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return NUMERIC_STRING.test(trimmed) ? Number(trimmed) : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof File !== 'undefined' && value instanceof File) return { file: value.name, size: value.size, lastModified: value.lastModified };
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(normalizeFormValue);

  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const entry = normalizeFormValue((value as Record<string, unknown>)[key]);
    if (entry !== null) normalized[key] = entry;
  }
  return Object.keys(normalized).length === 0 ? null : normalized;
}

/** Deep comparison of two (normalized) form value trees. */
export function areFormValuesEqual(current: unknown, baseline: unknown): boolean {
  return _.isEqual(normalizeFormValue(current), normalizeFormValue(baseline));
}

/** True when `current` differs from the initial / last-saved `baseline`. */
export function isFormDirty(current: unknown, baseline: unknown): boolean {
  return !areFormValuesEqual(current, baseline);
}

/** Trimmed string – for fields the form trims on submit. */
export function trimmed(value: string | null | undefined): string {
  return (value ?? '').trim();
}
