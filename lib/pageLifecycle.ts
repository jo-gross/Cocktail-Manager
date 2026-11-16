/**
 * Detects that the current page is being torn down (reload, full navigation, OAuth redirect).
 *
 * Browsers cancel all pending requests of a page that goes away. Firefox and Safari reject those
 * fetches while the old page still runs, so every pending load reported "error loading …" right
 * before the new page appeared (e.g. the full reload after the demo login). Failures are therefore
 * reported only after a short grace period: a page that goes away never gets there, and a
 * `beforeunload`/`pagehide` around the failure marks it as caused by the navigation.
 */

/** How long a failure waits before it is reported. */
export const UNLOAD_GRACE_MS = 400;
/** Unload signals up to this long before a failure still count (navigation cancelled the request). */
export const UNLOAD_SIGNAL_WINDOW_MS = 3000;

let lastUnloadSignalAt: number | null = null;
let trackingInstalled = false;

export function markPageUnloading(at: number = Date.now()) {
  lastUnloadSignalAt = at;
}

/** True if the page signaled an unload shortly before `since` or any time after it. */
export function isPageUnloadingSince(since: number): boolean {
  return lastUnloadSignalAt != null && lastUnloadSignalAt >= since - UNLOAD_SIGNAL_WINDOW_MS;
}

export function installPageLifecycleTracking(target: Pick<EventTarget, 'addEventListener'> | undefined = typeof window === 'undefined' ? undefined : window) {
  if (trackingInstalled || !target) return;
  trackingInstalled = true;
  // `beforeunload` is missing on iOS, `pagehide` comes late on desktop browsers: listen to both
  target.addEventListener('beforeunload', () => markPageUnloading());
  target.addEventListener('pagehide', () => markPageUnloading());
}

/**
 * Resolves after {@link UNLOAD_GRACE_MS} with `true` if the page stays, `false` if it is being
 * torn down. Without a window (SSR, tests) it resolves `true` right away.
 */
export function waitForPageToStay(since: number = Date.now()): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(true);
  installPageLifecycleTracking();
  return new Promise((resolve) => setTimeout(() => resolve(!isPageUnloadingSince(since)), UNLOAD_GRACE_MS));
}

/** Test helper. */
export function resetPageLifecycle() {
  lastUnloadSignalAt = null;
  trackingInstalled = false;
}
