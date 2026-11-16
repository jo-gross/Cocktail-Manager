/**
 * Browser persistence of the tour system:
 * - the running tour in sessionStorage (survives reloads within the tab)
 * - a local copy of the guide progress in localStorage (fallback while the progress API is unavailable / offline)
 */
import type { TourRun } from './engine';
import type { GuideProgress } from './registry';

const RUN_KEY = 'tour:run';
const progressKey = (userId: string) => `tour:progress:${userId}`;

function read<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota – progress is still kept in memory and on the server.
  }
}

const session = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);
const local = () => (typeof window === 'undefined' ? undefined : window.localStorage);

export function loadStoredRun(): TourRun | null {
  const run = read<TourRun>(session(), RUN_KEY);
  return run && typeof run.tourId === 'string' && Array.isArray(run.stepIds) && typeof run.stepIndex === 'number' ? run : null;
}

export function storeRun(run: TourRun | null) {
  write(session(), RUN_KEY, run);
}

export function loadLocalProgress(userId: string): Record<string, GuideProgress> {
  return read<Record<string, GuideProgress>>(local(), progressKey(userId)) ?? {};
}

export function storeLocalProgress(userId: string, progress: Record<string, GuideProgress>) {
  write(local(), progressKey(userId), progress);
}

/**
 * The server is authoritative: its entries always win (e.g. the `tour:basics-bar` DISMISSED rows the migration
 * creates for existing users). Local entries only fill guides the server does not know yet (written while the API
 * was unavailable) – they are returned as `unsynced` so the caller can upload them.
 */
export function mergeProgress(
  server: GuideProgress[],
  local: Record<string, GuideProgress>,
): { merged: Record<string, GuideProgress>; unsynced: GuideProgress[] } {
  const merged: Record<string, GuideProgress> = {};
  for (const entry of server) merged[entry.guideId] = entry;
  const unsynced = Object.values(local).filter((entry) => !(entry.guideId in merged));
  for (const entry of unsynced) merged[entry.guideId] = entry;
  return { merged, unsynced };
}
