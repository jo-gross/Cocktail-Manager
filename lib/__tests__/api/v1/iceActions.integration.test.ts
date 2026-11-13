import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { collectionHandler as iceCollectionHandler, itemHandler as iceItemHandler } from '@lib/api/v1/ices';
import { collectionHandler as actionsCollectionHandler, itemHandler as actionsItemHandler } from '@lib/api/v1/actions';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey, seedIce } from '@test/helpers/dbFixtures';
import { readTranslationBlob, seedAction, seedCocktailUsing } from '@test/helpers/fixtures/g4';
import type { IceDto } from '@lib/schemas/ices';

describe('ice v1 integration', () => {
  it('creates, updates and deletes ice with translations', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const manager = roleUser(a, 'MANAGER');

    const created = await callAs(manager, iceCollectionHandler, {
      method: 'POST',
      query: { workspaceId: ws },
      body: { name: 'Crushed', translations: { en: 'Crushed ice' } },
    });
    expect(created.status).toBe(200);
    const iceId = dataOf<IceDto>(created).id;

    const updated = await callAs(manager, iceItemHandler, {
      method: 'PUT',
      query: { workspaceId: ws, iceId },
      body: { name: 'Cubes', translations: { en: 'Ice cubes' } },
    });
    expect(updated.status).toBe(200);
    expect(dataOf<IceDto>(updated).name).toBe('Cubes');
    expect((await readTranslationBlob(ws)).en).toEqual({ Crushed: 'Crushed ice', Cubes: 'Ice cubes' });

    const deleted = await callAs(roleUser(a, 'ADMIN'), iceItemHandler, { method: 'DELETE', query: { workspaceId: ws, iceId } });
    expect(deleted.status).toBe(200);
    expect(await prisma.ice.count({ where: { workspaceId: ws } })).toBe(0);
  });

  it('writes no translation when the ice update fails (duplicate name)', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    await seedIce(ws, { name: 'Taken' });
    const ice = await seedIce(ws, { name: 'Mine' });

    const result = await callAs(roleUser(a, 'MANAGER'), iceItemHandler, {
      method: 'PUT',
      query: { workspaceId: ws, iceId: ice.id },
      body: { name: 'Taken', translations: { en: 'Should not be stored' } },
    });
    expect(result.status).toBe(409);
    expect(await readTranslationBlob(ws)).toEqual({});
    expect(await prisma.ice.findUnique({ where: { id: ice.id } })).toMatchObject({ name: 'Mine' });
  });

  it('returns 404 for tenant B ice ids and leaves B unchanged', async () => {
    const { a, b } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const foreign = await seedIce(b.workspace.id, { name: 'Foreign' });
    const query = { workspaceId: a.workspace.id, iceId: foreign.id };

    expect((await callAs(owner, iceItemHandler, { method: 'GET', query })).status).toBe(404);
    expect((await callAs(owner, iceItemHandler, { method: 'PUT', query, body: { name: 'Hijacked', translations: { en: 'x' } } })).status).toBe(404);
    expect((await callAs(owner, iceItemHandler, { method: 'DELETE', query })).status).toBe(404);

    expect(await prisma.ice.findUnique({ where: { id: foreign.id } })).toMatchObject({ name: 'Foreign' });
    expect(await readTranslationBlob(a.workspace.id)).toEqual({});
  });

  it('rejects writes for USER and for a read-only API key', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const body = { name: 'Crushed' };
    expect((await callAs(roleUser(a, 'USER'), iceCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body })).status).toBe(403);
    const key = await seedApiKey(ws, roleUser(a, 'OWNER').user.id, ['ICE_READ']);
    expect((await callAs({ apiKeyJwt: key.jwt }, iceCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body })).status).toBe(403);
    expect(await prisma.ice.count()).toBe(0);
  });

  it('rejects invalid translation languages and oversized names', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const manager = roleUser(a, 'MANAGER');
    for (const body of [
      { name: 'x'.repeat(101) },
      { name: 'ok', translations: { 'not a language': 'x' } },
      { name: 'ok', translations: { en: 'x'.repeat(501) } },
    ]) {
      const result = await callAs(manager, iceCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body });
      expect(result.status).toBe(400);
    }
    expect(await prisma.ice.count()).toBe(0);
  });
});

describe('actions v1 integration', () => {
  it('creates and updates an action with translations in one transaction', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const admin = roleUser(a, 'ADMIN');

    const created = await callAs(admin, actionsCollectionHandler, {
      method: 'POST',
      query: { workspaceId: ws },
      body: { name: 'SHAKE', actionGroup: 'MIXING', translations: { de: 'Schütteln' } },
    });
    expect(created.status).toBe(200);
    const actionId = dataOf<{ id: string }>(created).id;

    const updated = await callAs(admin, actionsItemHandler, {
      method: 'PUT',
      query: { workspaceId: ws, actionId },
      body: { actionGroup: 'MIXING', dilutionPercent: 30, translations: { en: 'Shake' } },
    });
    expect(updated.status).toBe(200);
    expect(dataOf<{ dilutionPercent: number }>(updated).dilutionPercent).toBe(30);
    expect(await readTranslationBlob(ws)).toEqual({ de: { SHAKE: 'Schütteln' }, en: { SHAKE: 'Shake' } });
  });

  it('writes no translation when the action create fails (duplicate)', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    await seedAction(ws, { name: 'SHAKE', actionGroup: 'MIXING' });
    const result = await callAs(roleUser(a, 'ADMIN'), actionsCollectionHandler, {
      method: 'POST',
      query: { workspaceId: ws },
      body: { name: 'SHAKE', actionGroup: 'MIXING', translations: { de: 'Schütteln' } },
    });
    expect(result.status).toBe(409);
    expect(await readTranslationBlob(ws)).toEqual({});
  });

  it('refuses to delete an action used by a cocktail with 409 ACTION_IN_USE', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const action = await seedAction(ws);
    await seedCocktailUsing(ws, { actionId: action.id });

    const result = await callAs(roleUser(a, 'ADMIN'), actionsItemHandler, { method: 'DELETE', query: { workspaceId: ws, actionId: action.id } });
    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('ACTION_IN_USE');
    expect(await prisma.workspaceCocktailRecipeStepAction.findUnique({ where: { id: action.id } })).not.toBeNull();
  });

  it('returns 404 for tenant B action ids and leaves B unchanged', async () => {
    const { a, b } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const foreign = await seedAction(b.workspace.id, { actionGroup: 'MIXING' });
    const query = { workspaceId: a.workspace.id, actionId: foreign.id };

    const put = await callAs(owner, actionsItemHandler, { method: 'PUT', query, body: { actionGroup: 'HIJACKED', translations: { en: 'x' } } });
    expect(put.status).toBe(404);
    expect((await callAs(owner, actionsItemHandler, { method: 'DELETE', query })).status).toBe(404);

    expect(await prisma.workspaceCocktailRecipeStepAction.findUnique({ where: { id: foreign.id } })).toMatchObject({ actionGroup: 'MIXING' });
    expect(await readTranslationBlob(a.workspace.id)).toEqual({});
  });

  it('rejects writes for a COCKTAILS_READ API key', async () => {
    const { a } = await seedTenantPair();
    const ws = a.workspace.id;
    const key = await seedApiKey(ws, roleUser(a, 'OWNER').user.id, ['COCKTAILS_READ']);
    const result = await callAs({ apiKeyJwt: key.jwt }, actionsCollectionHandler, {
      method: 'POST',
      query: { workspaceId: ws },
      body: { name: 'STIR', actionGroup: 'MIXING' },
    });
    expect(result.status).toBe(403);
    expect(await prisma.workspaceCocktailRecipeStepAction.count()).toBe(0);
  });
});
