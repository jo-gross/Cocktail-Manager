import { useEffect, useState } from 'react';
import type { EntitlementsMode } from '@lib/instance/config';

/**
 * `ENTITLEMENTS_MODE` of the instance for the browser (`GET /api/config/entitlements`), loaded once per page load and
 * shared by the plan UI and the announcement banner. With `off` (self-hosting) they skip their requests entirely.
 */
let resolved: EntitlementsMode | null = null;
let pending: Promise<EntitlementsMode> | null = null;

export function loadEntitlementsMode(): Promise<EntitlementsMode> {
  if (resolved) return Promise.resolve(resolved);
  pending ??= fetch('/api/config/entitlements')
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
    .then((body: { data?: { mode?: unknown } }) => {
      resolved = body?.data?.mode === 'managed' ? 'managed' : 'off';
      return resolved;
    })
    .catch((error) => {
      // Without the mode no plan UI is shown (the server still enforces); the next mount asks again.
      console.debug('loadEntitlementsMode', error);
      pending = null;
      return 'off' as const;
    });
  return pending;
}

/** The mode, `null` while loading. Loads only when `enabled` (signed in, on a page that shows plan or announcements). */
export function useEntitlementsMode(enabled = true): EntitlementsMode | null {
  const [mode, setMode] = useState<EntitlementsMode | null>(resolved);
  useEffect(() => {
    if (!enabled || mode) return;
    let active = true;
    void loadEntitlementsMode().then((value) => {
      if (active) setMode(value);
    });
    return () => {
      active = false;
    };
  }, [enabled, mode]);
  return mode;
}

/** Tests only. */
export function resetEntitlementsModeForTests(): void {
  resolved = null;
  pending = null;
}
