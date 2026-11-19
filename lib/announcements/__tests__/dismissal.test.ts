import { describe, expect, it } from 'vitest';
import {
  DISMISSED_ANNOUNCEMENTS_STORAGE_KEY,
  dismiss,
  dismissalKey,
  readDismissed,
  withoutDismissed,
  type DismissalStorage,
} from '@lib/announcements/dismissal';

function memoryStorage(initial: Record<string, string> = {}): DismissalStorage & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

const info = { id: 'a1', revision: 'r1', dismissible: true };

describe('announcement dismissal', () => {
  it('stores a dismissal per id and revision and reads it back', () => {
    const storage = memoryStorage();
    expect(readDismissed(storage)).toEqual([]);

    const dismissed = dismiss(storage, info, []);
    expect(dismissed).toEqual(['a1:r1']);
    expect(readDismissed(storage)).toEqual(['a1:r1']);
    expect(JSON.parse(storage.values[DISMISSED_ANNOUNCEMENTS_STORAGE_KEY]!)).toEqual(['a1:r1']);
  });

  it('does not store a key twice', () => {
    const storage = memoryStorage();
    expect(dismiss(storage, info, dismiss(storage, info, []))).toEqual(['a1:r1']);
  });

  it('hides a dismissed announcement until its revision changes', () => {
    const dismissed = [dismissalKey(info)];
    expect(withoutDismissed([info], dismissed)).toEqual([]);
    const changed = { ...info, revision: 'r2' };
    expect(withoutDismissed([changed], dismissed)).toEqual([changed]);
  });

  it('never hides announcements that are not dismissible', () => {
    const warning = { id: 'w1', revision: 'r1', dismissible: false };
    expect(withoutDismissed([warning], [dismissalKey(warning)])).toEqual([warning]);
  });

  it('caps the stored list, dropping the oldest entries', () => {
    const storage = memoryStorage();
    let dismissed: string[] = [];
    for (let index = 0; index < 205; index++) dismissed = dismiss(storage, { id: `a${index}`, revision: 'r' }, dismissed);
    expect(dismissed).toHaveLength(200);
    expect(dismissed[0]).toBe('a5:r');
    expect(dismissed.at(-1)).toBe('a204:r');
  });

  it('survives a missing, unreadable or blocked storage', () => {
    expect(readDismissed(null)).toEqual([]);
    expect(readDismissed(memoryStorage({ [DISMISSED_ANNOUNCEMENTS_STORAGE_KEY]: 'not json' }))).toEqual([]);
    expect(readDismissed(memoryStorage({ [DISMISSED_ANNOUNCEMENTS_STORAGE_KEY]: '{"a":1}' }))).toEqual([]);
    const blocked: DismissalStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readDismissed(blocked)).toEqual([]);
    // The dismissal still applies to the open page.
    expect(dismiss(blocked, info, [])).toEqual(['a1:r1']);
    expect(dismiss(null, info, [])).toEqual(['a1:r1']);
  });
});
