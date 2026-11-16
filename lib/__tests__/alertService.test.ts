import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, alertService, DUPLICATE_ERROR_WINDOW_MS, isDuplicateError } from '../alertService';
import { resetPageLifecycle, UNLOAD_GRACE_MS } from '../pageLifecycle';

describe('isDuplicateError', () => {
  it('suppresses an identical error while it is still visible', () => {
    const key = `dup-${Math.random()}`;
    expect(isDuplicateError(key, 1_000)).toBe(false);
    expect(isDuplicateError(key, 1_000 + DUPLICATE_ERROR_WINDOW_MS - 1)).toBe(true);
    expect(isDuplicateError(key, 1_000 + 2 * DUPLICATE_ERROR_WINDOW_MS)).toBe(false);
  });

  it('keeps different errors apart', () => {
    expect(isDuplicateError(`a-${Math.random()}`, 1_000)).toBe(false);
    expect(isDuplicateError(`b-${Math.random()}`, 1_000)).toBe(false);
  });
});

describe('alertService.error', () => {
  let target: EventTarget;
  let received: Alert[];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    resetPageLifecycle();
    target = new EventTarget();
    vi.stubGlobal('window', target);
    received = [];
    const subscription = alertService.onAlert().subscribe((alert) => received.push(alert));
    unsubscribe = () => subscription.unsubscribe();
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the error after the grace period', async () => {
    alertService.error('Fehler beim Laden der Karten (stays)');
    expect(received).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS);
    expect(received.map((a) => a.message)).toEqual(['Fehler beim Laden der Karten (stays)']);
  });

  it('drops errors of requests cancelled by a reload/navigation', async () => {
    alertService.error('Fehler beim Laden der Karten (unload)');
    target.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS);
    expect(received).toHaveLength(0);
  });

  it('reports a burst of identical failures once', async () => {
    for (let i = 0; i < 20; i++) alertService.error('Fehler beim Laden der Cocktail-Bewertungen (burst)');
    alertService.error('Fehler beim Laden der Cocktail-Bewertungen (burst)', 500, 'ERROR');
    await vi.advanceTimersByTimeAsync(UNLOAD_GRACE_MS);
    expect(received.map((a) => a.status)).toEqual([undefined, 500]);
  });
});
