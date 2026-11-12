import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { translationHandler, translationsCollectionHandler } from '@lib/api/v1/translations';
import { contentTranslationsHandler } from '@lib/api/v1/contentTranslations';
import { callAs, dataOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey, seedGlass } from '@test/helpers/dbFixtures';
import { readTranslationBlob } from '@test/helpers/fixtures/g4';
import type { ContentTranslationsDto, ContentTranslationsUpdateResult } from '@lib/schemas/contentTranslations';

describe('workspace translations v1 integration', () => {
  it('merges a key and returns the catalog', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const put = await callAs(roleUser(a, 'ADMIN'), translationsCollectionHandler, {
      method: 'PUT',
      query: { workspaceId: ws },
      body: { key: 'SHAKE', translations: { de: 'Schütteln', en: 'Shake' } },
    });
    expect(put.status).toBe(200);

    const legacy = await callAs(roleUser(a, 'ADMIN'), translationHandler, {
      method: 'PUT',
      query: { workspaceId: ws },
      body: { key: 'STIR', translations: { de: 'Rühren' } },
    });
    expect(legacy.status).toBe(200);

    const get = await callAs(roleUser(a, 'USER'), translationsCollectionHandler, { method: 'GET', query: { workspaceId: ws } });
    expect(dataOf(get)).toEqual({ de: { SHAKE: 'Schütteln', STIR: 'Rühren' }, en: { SHAKE: 'Shake' } });
  });

  it('does not lose updates under 20 concurrent PUTs', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const admin = roleUser(a, 'ADMIN');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        callAs(admin, translationsCollectionHandler, {
          method: 'PUT',
          query: { workspaceId: ws },
          body: { key: `key-${index}`, translations: { en: `value-${index}` } },
        }),
      ),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(Object.keys((await readTranslationBlob(ws)).en)).toHaveLength(20);
  });

  it('rejects prototype keys, invalid languages and oversized input without writing', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const admin = roleUser(a, 'ADMIN');
    const bodies = [
      { key: '__proto__', translations: { en: 'x' } },
      { key: 'SHAKE', translations: { 'en; drop': 'x' } },
      { key: 'x'.repeat(201), translations: { en: 'x' } },
      { key: 'SHAKE', translations: { en: 'x'.repeat(501) } },
    ];
    for (const body of bodies) {
      const result = await callAs(admin, translationsCollectionHandler, { method: 'PUT', query: { workspaceId: ws }, body });
      expect(result.status, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
    expect(await prisma.workspaceSetting.count({ where: { workspaceId: ws, setting: 'translations' } })).toBe(0);

    // zod drops a `__proto__` record key, so nothing reaches the catalog or Object.prototype.
    const proto = await callAs(admin, translationsCollectionHandler, {
      method: 'PUT',
      query: { workspaceId: ws },
      body: JSON.parse('{"key":"SHAKE","translations":{"__proto__":"polluted","en":"Shake"}}'),
    });
    expect(proto.status).toBe(200);
    expect(await readTranslationBlob(ws)).toEqual({ en: { SHAKE: 'Shake' } });
    expect(({} as Record<string, unknown>).SHAKE).toBeUndefined();
  });

  it('ignores prototype keys in a stored blob', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    await prisma.workspaceSetting.create({ data: { workspaceId: ws, setting: 'translations', value: '{"__proto__":{"polluted":"x"},"de":{"A":"a","B":3}}' } });
    const get = await callAs(roleUser(a, 'USER'), translationsCollectionHandler, { method: 'GET', query: { workspaceId: ws } });
    expect(dataOf(get)).toEqual({ de: { A: 'a' } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('only reads and writes the own workspace catalog; denies MANAGER and read-only keys', async () => {
    const { a, b } = await seedTenantPair();
    await prisma.workspaceSetting.create({ data: { workspaceId: b.workspace.id, setting: 'translations', value: '{"de":{"SECRET":"b"}}' } });
    const get = await callAs(roleUser(a, 'USER'), translationsCollectionHandler, { method: 'GET', query: { workspaceId: a.workspace.id } });
    expect(dataOf(get)).toEqual({});

    const body = { key: 'SHAKE', translations: { en: 'Shake' } };
    const manager = await callAs(roleUser(a, 'MANAGER'), translationsCollectionHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body });
    expect(manager.status).toBe(403);
    const key = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['WORKSPACE_READ']);
    const readOnly = await callAs({ apiKeyJwt: key.jwt }, translationsCollectionHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body });
    expect(readOnly.status).toBe(403);
    expect(await prisma.workspaceSetting.count({ where: { workspaceId: a.workspace.id, setting: 'translations' } })).toBe(0);
  });
});

describe('content translations v1 integration', () => {
  it('writes own entities and skips tenant B ids without touching B', async () => {
    const { a, b } = await seedTenantPair();
    const own = await seedGlass(a.workspace.id, { name: 'Tumbler' });
    const foreign = await seedGlass(b.workspace.id, { name: 'Foreign' });

    const result = await callAs(roleUser(a, 'MANAGER'), contentTranslationsHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id },
      body: {
        items: [
          { entityType: 'glass', entityId: own.id, field: 'name', locale: 'en', value: 'Tumbler EN' },
          { entityType: 'glass', entityId: foreign.id, field: 'name', locale: 'en', value: 'Hijacked' },
        ],
      },
    });
    expect(result.status).toBe(200);
    expect(dataOf<ContentTranslationsUpdateResult>(result)).toEqual({ updated: 1, skipped: 1 });
    expect(await prisma.glassTranslation.findMany({ where: { glassId: own.id } })).toMatchObject([{ locale: 'en', name: 'Tumbler EN' }]);
    expect(await prisma.glassTranslation.count({ where: { glassId: foreign.id } })).toBe(0);

    const list = await callAs(roleUser(a, 'USER'), contentTranslationsHandler, {
      method: 'GET',
      query: { workspaceId: a.workspace.id, locale: 'en', entity: 'glass', entityId: foreign.id },
    });
    expect(list.status).toBe(200);
    expect(dataOf<ContentTranslationsDto>(list).rows).toEqual([]);
  });

  it('clears a translation with an empty value', async () => {
    const { a } = await seedTenantPair();
    const glass = await seedGlass(a.workspace.id);
    await prisma.glassTranslation.create({ data: { glassId: glass.id, locale: 'en', name: 'Old' } });
    const result = await callAs(roleUser(a, 'MANAGER'), contentTranslationsHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id },
      body: { items: [{ entityType: 'glass', entityId: glass.id, field: 'name', locale: 'en', value: '' }] },
    });
    expect(result.status).toBe(200);
    expect(await prisma.glassTranslation.count({ where: { glassId: glass.id } })).toBe(0);
  });

  it('rejects the whole request when one item is invalid', async () => {
    const { a } = await seedTenantPair();
    const glass = await seedGlass(a.workspace.id);
    const result = await callAs(roleUser(a, 'MANAGER'), contentTranslationsHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id },
      body: {
        items: [
          { entityType: 'glass', entityId: glass.id, field: 'name', locale: 'en', value: 'ok' },
          { entityType: 'glass', entityId: glass.id, field: 'description', locale: 'en', value: 'not translatable' },
          { entityType: 'glass', entityId: glass.id, field: 'name', locale: 'fr', value: 'x'.repeat(10_001) },
        ],
      },
    });
    expect(result.status).toBe(400);
    expect(await prisma.glassTranslation.count()).toBe(0);
  });

  it('rejects writes for USER and for a TRANSLATIONS_READ key', async () => {
    const { a } = await seedTenantPair();
    const glass = await seedGlass(a.workspace.id);
    const body = { items: [{ entityType: 'glass', entityId: glass.id, field: 'name', locale: 'en', value: 'x' }] };
    expect((await callAs(roleUser(a, 'USER'), contentTranslationsHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body })).status).toBe(403);
    const key = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['TRANSLATIONS_READ']);
    expect((await callAs({ apiKeyJwt: key.jwt }, contentTranslationsHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body })).status).toBe(
      403,
    );
    expect(await prisma.glassTranslation.count()).toBe(0);
  });
});
