import { randomBytes } from 'node:crypto';
import prisma from '../../prisma/prisma';
import { createApiKeyJwt } from '@middleware/api/jwtApiKeyMiddleware';
import type { Permission, Role, User, Workspace } from '@generated/prisma/client';

export interface SeededUser {
  user: User;
  role: Role;
  sessionToken: string;
}

export interface SeededWorkspace {
  workspace: Workspace;
  users: SeededUser[];
}

export interface SeedWorkspaceOptions {
  name?: string;
  users?: Array<{ role: Role; email?: string; name?: string }>;
}

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export async function seedWorkspace(options: SeedWorkspaceOptions = {}): Promise<SeededWorkspace> {
  const workspace = await prisma.workspace.create({
    data: { name: options.name ?? `Test Workspace ${randomToken().slice(0, 8)}` },
  });

  const userSpecs = options.users ?? [{ role: 'USER' as Role }, { role: 'MANAGER' as Role }, { role: 'ADMIN' as Role }];
  const users: SeededUser[] = [];

  for (const spec of userSpecs) {
    const user = await prisma.user.create({
      data: {
        name: spec.name ?? `${spec.role} User`,
        email: spec.email ?? `${spec.role.toLowerCase()}-${randomToken().slice(0, 8)}@test.local`,
        emailVerified: true,
      },
    });

    await prisma.workspaceUser.create({
      data: { workspaceId: workspace.id, userId: user.id, role: spec.role },
    });

    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { token: sessionToken, userId: user.id, expiresAt },
    });

    users.push({ user, role: spec.role, sessionToken });
  }

  return { workspace, users };
}

export function findUserByRole(seeded: SeededWorkspace, role: Role): SeededUser {
  const found = seeded.users.find((u) => u.role === role);
  if (!found) throw new Error(`No user with role ${role} in seeded workspace`);
  return found;
}

export interface SeededApiKey {
  keyId: string;
  jwt: string;
  recordId: string;
}

export async function seedApiKey(workspaceId: string, createdByUserId: string, permissions: Permission[], name = 'Test API Key'): Promise<SeededApiKey> {
  const keyId = `key_${randomToken().slice(0, 16)}`;
  const record = await prisma.workspaceApiKey.create({
    data: {
      workspaceId,
      name,
      keyId,
      createdByUserId,
      permissions: {
        create: permissions.map((permission) => ({ permission })),
      },
    },
  });

  const jwt = createApiKeyJwt(keyId, workspaceId, permissions);
  return { keyId, jwt, recordId: record.id };
}

export async function seedGlass(workspaceId: string, overrides: { name?: string; deposit?: number } = {}) {
  return prisma.glass.create({
    data: {
      name: overrides.name ?? `Glass ${randomToken().slice(0, 6)}`,
      deposit: overrides.deposit ?? 0,
      workspaceId,
    },
  });
}

export async function seedCocktail(workspaceId: string, glassId: string, overrides: { name?: string } = {}) {
  return prisma.cocktailRecipe.create({
    data: {
      name: overrides.name ?? `Cocktail ${randomToken().slice(0, 6)}`,
      workspaceId,
      glassId,
    },
  });
}

export async function seedIngredient(workspaceId: string, overrides: { name?: string } = {}) {
  return prisma.ingredient.create({
    data: {
      name: overrides.name ?? `Ingredient ${randomToken().slice(0, 6)}`,
      workspaceId,
    },
  });
}

export async function seedTag(workspaceId: string, overrides: { name?: string } = {}) {
  return prisma.tag.create({
    data: {
      name: overrides.name ?? `Tag ${randomToken().slice(0, 6)}`,
      workspaceId,
    },
  });
}

export async function seedIce(workspaceId: string, overrides: { name?: string } = {}) {
  return prisma.ice.create({
    data: {
      name: overrides.name ?? `Ice ${randomToken().slice(0, 6)}`,
      workspaceId,
    },
  });
}

/** Truncate all public tables for test isolation. */
export async function truncateAllTables(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  const tableNames = tables.map((t) => t.tablename).filter((name) => name !== '_prisma_migrations');
  if (tableNames.length === 0) return;

  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
  }
}
