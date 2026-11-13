/**
 * Fixtures for membership / join / API-key integration tests (group g6).
 */
import { randomBytes } from 'node:crypto';
import type { Role } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import type { SeededUser } from '../dbFixtures';

/** A user with a valid session who is not a member of any workspace (role is a placeholder). */
export async function seedSessionUser(name = 'Outsider'): Promise<SeededUser> {
  const suffix = randomBytes(6).toString('hex');
  const user = await prisma.user.create({ data: { name, email: `outsider-${suffix}@test.local`, emailVerified: true } });
  const sessionToken = randomBytes(32).toString('hex');
  await prisma.session.create({ data: { token: sessionToken, userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  return { user, role: 'USER', sessionToken };
}

export async function membershipRole(workspaceId: string, userId: string): Promise<Role | null> {
  const membership = await prisma.workspaceUser.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } });
  return membership?.role ?? null;
}

export async function ownerCount(workspaceId: string): Promise<number> {
  return prisma.workspaceUser.count({ where: { workspaceId, role: 'OWNER' } });
}
