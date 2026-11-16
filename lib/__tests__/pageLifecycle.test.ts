import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installPageLifecycleTracking,
  isPageUnloadingSince,
  markPageUnloading,
  resetPageLifecycle,
  UNLOAD_GRACE_MS,
  UNLOAD_SIGNAL_WINDOW_MS,
  waitForPageToStay,
} from '../pageLifecycle';

describe('pageLifecycle', () => {
  beforeEach(() => resetPageLifecycle());

  it('is not unloading without a signal', () => {
    expect(isPageUnloadingSince(1_000_000)).toBe(false);
  });

  it('counts unload signals after the failure and shortly before it', () => {
    const failedAt = 1_000_000;
    markPageUnloading(failedAt + 200);
    expect(isPageUnloadingSince(failedAt)).toBe(true);

    markPageUnloading(failedAt - UNLOAD_SIGNAL_WINDOW_MS + 1);
    expect(isPageUnloadingSince(failedAt)).toBe(true);
  });

  it('ignores old unload signals (e.g. beforeunload of a download that kept the page)', () => {
    const failedAt = 1_000_000;
    markPageUnloading(failedAt - UNLOAD_SIGNAL_WINDOW_MS - 1);
    expect(isPageUnloadingSince(failedAt)).toBe(false);
  });

  it('marks the page on beforeunload and pagehide', () => {
    const target = new EventTarget();
    installPageLifecycleTracking(target);
    const since = Date.now();
    expect(isPageUnloadingSince(since)).toBe(false);
    target.dispatchEvent(new Event('pagehide'));
    expect(isPageUnloadingSince(since)).toBe(true);

    resetPageLifecycle();
    const other = new EventTarget();
    installPageLifecycleTracking(other);
    other.dispatchEvent(new Event('beforeunload'));
    expect(isPageUnloadingSince(since)).toBe(true);
  });

  it('resolves immediately without a window', async () => {
    await expect(waitForPageToStay()).resolves.toBe(true);
  });

  describe('in a browser', () => {
    let target: EventTarget;

    beforeEach(() => {
      vi.useFakeTimers();
      target = new EventTarget();
      vi.stubGlobal('window', target);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('reports a failure when the page stays', async () => {
      const result = waitForPageToStay();
      await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS);
      await expect(result).resolves.toBe(true);
    });

    it('drops a failure when the page unloads during the grace period', async () => {
      const result = waitForPageToStay();
      await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS / 2);
      target.dispatchEvent(new Event('beforeunload'));
      await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS);
      await expect(result).resolves.toBe(false);
    });
  });
});
