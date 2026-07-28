import { describe, it, expect } from 'vitest';
import { collectionHandler, itemHandler } from '@lib/api/v1/ingredients';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedWorkspace } from '@test/helpers/dbFixtures';
import { IngredientDtoSchema } from '@lib/schemas/ingredients';

describe('ingredients v1 integration', () => {
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
      body: { name: 'Rum' },
      headers: sessionCookie(user.sessionToken),
    });
    expect(result.status).toBe(403);
  });

  it('creates, reads and deletes an ingredient', async () => {
    const seeded = await setup();
    const manager = findUserByRole(seeded, 'MANAGER');
    const admin = findUserByRole(seeded, 'ADMIN');

    const createResult = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Rum', price: 12.5 },
      headers: sessionCookie(manager.sessionToken),
    });
    expect(createResult.status).toBe(200);
    const created = (createResult.json as { data: unknown }).data;
    expect(IngredientDtoSchema.safeParse(created).success).toBe(true);
    const ingredientId = (created as { id: string }).id;

    const getResult = await invokeHandler(itemHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id, ingredientId },
      headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
    });
    expect(getResult.status).toBe(200);

    const deleteResult = await invokeHandler(itemHandler, {
      method: 'DELETE',
      query: { workspaceId: seeded.workspace.id, ingredientId },
      headers: sessionCookie(admin.sessionToken),
    });
    expect(deleteResult.status).toBe(200);
  });
});
