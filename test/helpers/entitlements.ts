/** Entitlement snapshots and pushes for tests (docs/ENTITLEMENTS.md). */
import { createHash } from 'node:crypto';
import type { SnapshotWire } from '@lib/entitlements/snapshot';

/** A valid wire snapshot (Homebar Free limits); `hash` follows the content so different snapshots differ. */
export function snapshotWire(overrides: Partial<SnapshotWire> = {}): SnapshotWire {
  const content: Omit<SnapshotWire, 'version' | 'hash'> = {
    planKey: 'homebar_free',
    planName: { de: 'Homebar Free', en: 'Homebar Free' },
    status: 'ACTIVE',
    limits: { cocktails: 50, members: 2, calculations: 3, guestMenusPublished: 1, signageScreens: 0, apiKeys: 0 },
    features: [],
    billing: 'portal',
    nextChangeAt: null,
    ...overrides,
  };
  const hash = overrides.hash ?? createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return { version: 1, ...content, hash, ...(overrides.version !== undefined ? { version: overrides.version } : {}) };
}

/** Unlimited limits; spread and override single keys. */
export const UNLIMITED = { cocktails: null, members: null, calculations: null, guestMenusPublished: null, signageScreens: null, apiKeys: null } as const;
