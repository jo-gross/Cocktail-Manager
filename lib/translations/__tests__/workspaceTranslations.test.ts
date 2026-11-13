import { describe, it, expect, vi } from 'vitest';

vi.mock('@lib/db/tx', () => ({ lockWorkspaceScope: vi.fn(), runTx: vi.fn() }));

const { parseTranslationCatalog, updateTranslation } = await import('@lib/translations/workspaceTranslations');

describe('parseTranslationCatalog', () => {
  it('keeps string entries and drops malformed or prototype keys', () => {
    const catalog = parseTranslationCatalog('{"__proto__":{"x":"y"},"de":{"A":"a","B":1,"constructor":"c"},"en":"broken"}');
    expect(JSON.parse(JSON.stringify(catalog))).toEqual({ de: { A: 'a' } });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('returns an empty catalog for invalid JSON and non-objects', () => {
    expect(Object.keys(parseTranslationCatalog('{oops'))).toEqual([]);
    expect(Object.keys(parseTranslationCatalog('[1,2]'))).toEqual([]);
    expect(Object.keys(parseTranslationCatalog(null))).toEqual([]);
  });
});

describe('updateTranslation', () => {
  function fakeTx(stored: string | null) {
    const upsert = vi.fn(async (args: { update: { value: string } }) => args);
    const tx = { workspaceSetting: { findFirst: vi.fn(async () => (stored === null ? null : { value: stored })), upsert } };
    return { tx: tx as never, upsert };
  }

  it('merges a key into the stored catalog', async () => {
    const { tx, upsert } = fakeTx('{"de":{"STIR":"Rühren"}}');
    await updateTranslation(tx, 'ws', 'SHAKE', { de: 'Schütteln', en: 'Shake' });
    expect(JSON.parse(upsert.mock.calls[0][0].update.value)).toEqual({ de: { STIR: 'Rühren', SHAKE: 'Schütteln' }, en: { SHAKE: 'Shake' } });
  });

  it('ignores prototype keys and languages', async () => {
    const { tx, upsert } = fakeTx(null);
    await updateTranslation(tx, 'ws', '__proto__', { en: 'x' });
    await updateTranslation(tx, 'ws', 'SHAKE', JSON.parse('{"__proto__":"x","constructor":"y"}'));
    expect(JSON.parse(upsert.mock.calls[0][0].update.value)).toEqual({});
    expect(JSON.parse(upsert.mock.calls[1][0].update.value)).toEqual({});
    expect(({} as Record<string, unknown>).SHAKE).toBeUndefined();
  });
});
