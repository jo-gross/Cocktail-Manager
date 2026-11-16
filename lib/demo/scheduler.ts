/**
 * In-process cleanup of expired demo workspaces (replaces the former cron container):
 * started once from `instrumentation.ts` on demo instances, runs shortly after the start
 * and then hourly. Failures are logged; the next run tries again.
 */
import { cleanupExpiredDemoWorkspaces } from '@lib/demo/cleanup';

export const DEMO_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

let started = false;

async function runCleanup(): Promise<void> {
  try {
    await cleanupExpiredDemoWorkspaces();
  } catch (error) {
    console.error('[DemoCleanup] Cleanup of expired demo workspaces failed:', error);
  }
}

/** Idempotent; the timers never keep the process alive. */
export function startDemoCleanupSchedule(): void {
  if (started) return;
  started = true;
  setTimeout(() => void runCleanup(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void runCleanup(), DEMO_CLEANUP_INTERVAL_MS).unref();
  console.info('[DemoCleanup] Hourly cleanup of expired demo workspaces scheduled');
}
