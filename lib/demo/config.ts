/**
 * Demo instance switches, read at runtime (not inlined at build time), so the regular
 * image runs as demo instance with `DEMO_MODE=true`. The client reads them via `/api/config/demo`.
 */
export const DEFAULT_DEMO_TTL_HOURS = 24;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/** Lifetime of a demo workspace (`DEMO_TTL_HOURS`, default 24). */
export function getDemoTtlHours(): number {
  const hours = parseInt(process.env.DEMO_TTL_HOURS || '', 10);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_DEMO_TTL_HOURS;
}
