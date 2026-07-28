import { describe, it, expect } from 'vitest';
import { collectionHandler } from '@lib/api/v1/cocktails';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';

describe('cocktails v1 integration', () => {
  async function setup() {
    return seedWorkspace({
      users: [{ role: 'USER' }, { role: 'MANAGER' }, { role: 'ADMIN' }],
    });
  }

  it('GET collection returns 401 without auth', async () => {
    const seeded = await setup();
    const result = await invokeHandler(collectionHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id },
    });
    expect(result.status).toBe(401);
  });

  it('POST collection returns 403 for USER role', async () => {
    const seeded = await setup();
    const user = findUserByRole(seeded, 'USER');
    const result = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Mojito' },
      headers: sessionCookie(user.sessionToken),
    });
    expect(result.status).toBe(403);
  });

  it('creates and lists cocktails as MANAGER', async () => {
    const seeded = await setup();
    const manager = findUserByRole(seeded, 'MANAGER');
    const glass = await seedGlass(seeded.workspace.id);

    const createResult = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Mojito', glassId: glass.id },
      headers: sessionCookie(manager.sessionToken),
    });
    expect(createResult.status).toBe(200);
    expect((createResult.json as { data: { name: string } }).data.name).toBe('Mojito');

    const listResult = await invokeHandler(collectionHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id },
      headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
    });
    expect(listResult.status).toBe(200);
    expect((listResult.json as { data: unknown[] }).data.length).toBeGreaterThanOrEqual(1);
  });
});
