/** Formatting helpers shared by the renderer (server) and the guest shell (client) – no heavy deps. */

/** Price via `Intl.NumberFormat(locale, { style: 'currency', currency })`; '' for non-numbers. */
export function formatMoney(value: unknown, locale: string, currency: string): string {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return '';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(number);
  } catch {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(number);
  }
}
