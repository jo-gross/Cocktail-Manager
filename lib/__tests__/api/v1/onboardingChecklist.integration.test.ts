/**
 * Marking onboarding checklist items as done without doing them
 * (`PUT /workspaces/{id}/onboarding/checklist/{itemId}`, setting `onboardingChecklistSkipped`).
 */
import { describe, expect, it } from 'vitest';
import { WorkspaceSettingKey } from '@generated/prisma/client';
import prisma from '../../../../prisma/prisma';
import { checklistItemHandler, onboardingHandler } from '@lib/api/v1/onboarding';
import { settingsHandler } from '@lib/api/v1/workspace';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import type { OnboardingDto } from '@lib/schemas/onboarding';

const skippedSetting = (workspaceId: string) =>
  prisma.workspaceSetting.findUnique({ where: { workspaceId_setting: { workspaceId, setting: WorkspaceSettingKey.onboardingChecklistSkipped } } });

const itemOf = (dto: OnboardingDto, id: string) => dto.checklist.find((item) => item.id === id);

describe('onboarding checklist: mark as done', () => {
  it('marks an item as skipped for the whole workspace and reverts it', async () => {
    const { a } = await seedTenantPair();
    const query = { workspaceId: a.workspace.id, itemId: 'guestMenu' };

    const initial = dataOf<OnboardingDto>(await callAs(roleUser(a, 'USER'), onboardingHandler, { method: 'GET', query: { workspaceId: a.workspace.id } }));
    expect(initial.checklist.every((item) => item.skipped === false)).toBe(true);

    const put = await callAs(roleUser(a, 'MANAGER'), checklistItemHandler, { method: 'PUT', query, body: { skipped: true } });
    expect(put.status).toBe(200);
    expect(itemOf(dataOf<OnboardingDto>(put), 'guestMenu')).toEqual({ id: 'guestMenu', done: false, skipped: true, open: 1 });

    // Idempotent; a second item keeps the first one.
    await callAs(roleUser(a, 'MANAGER'), checklistItemHandler, { method: 'PUT', query, body: { skipped: true } });
    await callAs(roleUser(a, 'ADMIN'), checklistItemHandler, { method: 'PUT', query: { ...query, itemId: 'cards' }, body: { skipped: true } });
    expect((await skippedSetting(a.workspace.id))?.value).toBe('["cards","guestMenu"]');

    // Shared by every member of the workspace.
    const asUser = dataOf<OnboardingDto>(await callAs(roleUser(a, 'USER'), onboardingHandler, { method: 'GET', query: { workspaceId: a.workspace.id } }));
    expect(asUser.checklist.filter((item) => item.skipped).map((item) => item.id)).toEqual(['cards', 'guestMenu']);

    // Also visible in the settings map.
    const settings = dataOf<Record<string, string | null>>(
      await callAs(roleUser(a, 'USER'), settingsHandler, { method: 'GET', query: { workspaceId: a.workspace.id } }),
    );
    expect(settings.onboardingChecklistSkipped).toBe('["cards","guestMenu"]');

    await callAs(roleUser(a, 'MANAGER'), checklistItemHandler, { method: 'PUT', query, body: { skipped: false } });
    const reverted = dataOf<OnboardingDto>(
      await callAs(roleUser(a, 'MANAGER'), checklistItemHandler, { method: 'PUT', query: { ...query, itemId: 'cards' }, body: { skipped: false } }),
    );
    expect(reverted.checklist.every((item) => item.skipped === false)).toBe(true);
    expect(await skippedSetting(a.workspace.id)).toBeNull();
  });

  it('keeps concurrent toggles of different items', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const items = ['glasses', 'ingredients', 'cocktails', 'cards', 'prices', 'guestInfo', 'team', 'guestMenu'];

    const results = await Promise.all(
      items.map((itemId) => callAs(manager, checklistItemHandler, { method: 'PUT', query: { workspaceId: a.workspace.id, itemId }, body: { skipped: true } })),
    );
    expect(results.map((result) => result.status)).toEqual(items.map(() => 200));
    expect(JSON.parse((await skippedSetting(a.workspace.id))?.value ?? '[]')).toEqual(items);
  });

  it('validates item id and body', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');

    const unknownItem = await callAs(manager, checklistItemHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, itemId: 'unknown' },
      body: { skipped: true },
    });
    expect(unknownItem.status).toBe(400);
    const badBody = await callAs(manager, checklistItemHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, itemId: 'team' },
      body: { skipped: 'yes' },
    });
    expect(badBody.status).toBe(400);
    expect(errorCodeOf(badBody)).toBe('VALIDATION_ERROR');

    // The generic settings endpoint validates the value as well.
    const badSetting = await callAs(manager, settingsHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id },
      body: { setting: 'onboardingChecklistSkipped', value: '["nope"]' },
    });
    expect(badSetting.status).toBe(400);
    expect(await skippedSetting(a.workspace.id)).toBeNull();
  });

  it('requires MANAGER or an API key with WORKSPACE_UPDATE', async () => {
    const { a } = await seedTenantPair();
    const query = { workspaceId: a.workspace.id, itemId: 'team' };

    expect((await callAs(roleUser(a, 'USER'), checklistItemHandler, { method: 'PUT', query, body: { skipped: true } })).status).toBe(403);
    expect((await callAs('anonymous', checklistItemHandler, { method: 'PUT', query, body: { skipped: true } })).status).toBe(401);

    const readKey = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['WORKSPACE_READ']);
    expect((await callAs({ apiKeyJwt: readKey.jwt }, checklistItemHandler, { method: 'PUT', query, body: { skipped: true } })).status).toBe(403);
    expect(await skippedSetting(a.workspace.id)).toBeNull();

    const writeKey = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['WORKSPACE_UPDATE']);
    expect((await callAs({ apiKeyJwt: writeKey.jwt }, checklistItemHandler, { method: 'PUT', query, body: { skipped: true } })).status).toBe(200);
    expect((await skippedSetting(a.workspace.id))?.value).toBe('["team"]');
  });

  it("cannot touch another tenant's checklist", async () => {
    const { a, b } = await seedTenantPair();
    await callAs(roleUser(b, 'MANAGER'), checklistItemHandler, {
      method: 'PUT',
      query: { workspaceId: b.workspace.id, itemId: 'cards' },
      body: { skipped: true },
    });

    const foreign = await callAs(roleUser(a, 'OWNER'), checklistItemHandler, {
      method: 'PUT',
      query: { workspaceId: b.workspace.id, itemId: 'cards' },
      body: { skipped: false },
    });
    expect([403, 404]).toContain(foreign.status);
    expect((await skippedSetting(b.workspace.id))?.value).toBe('["cards"]');
    expect(await skippedSetting(a.workspace.id)).toBeNull();

    const own = dataOf<OnboardingDto>(await callAs(roleUser(a, 'OWNER'), onboardingHandler, { method: 'GET', query: { workspaceId: a.workspace.id } }));
    expect(itemOf(own, 'cards')?.skipped).toBe(false);
  });
});
