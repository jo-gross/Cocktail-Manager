/**
 * Membership hardening: owner-role escalation and last-owner guards, leave, join codes, the join
 * endpoint (atomic one-time codes, rate limit) and join-request accept/reject races.
 */
import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { itemHandler as usersItemHandler } from '@lib/api/v1/workspaceUsers';
import { leaveHandler } from '@lib/api/v1/leave';
import joinHandler from '@lib/api/v1/join';
import { acceptHandler, rejectHandler, collectionHandler as joinRequestsHandler } from '@lib/api/v1/joinRequests';
import { collectionHandler as joinCodesHandler, itemHandler as joinCodeItemHandler } from '@lib/api/v1/joinCodes';
import { JOIN_CODE_PATTERN } from '@lib/schemas/joinCodes';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';
import { membershipRole, ownerCount, seedSessionUser } from '@test/helpers/fixtures/g6';

function setRole(caller: Parameters<typeof callAs>[0], workspaceId: string, userId: string, role: string) {
  return callAs(caller, usersItemHandler, { method: 'PUT', query: { workspaceId, userId }, body: { role } });
}

function removeMember(caller: Parameters<typeof callAs>[0], workspaceId: string, userId: string) {
  return callAs(caller, usersItemHandler, { method: 'DELETE', query: { workspaceId, userId } });
}

describe('workspace users: owner role and last-owner guard', () => {
  it('an ADMIN session cannot grant OWNER, demote or remove an OWNER', async () => {
    const { a } = await seedTenantPair();
    const admin = roleUser(a, 'ADMIN');
    const owner = roleUser(a, 'OWNER');
    const user = roleUser(a, 'USER');

    const promote = await setRole(admin, a.workspace.id, user.user.id, 'OWNER');
    expect(promote.status).toBe(403);
    expect(errorCodeOf(promote)).toBe('OWNER_REQUIRED');

    const demote = await setRole(admin, a.workspace.id, owner.user.id, 'USER');
    expect(demote.status).toBe(403);

    const remove = await removeMember(admin, a.workspace.id, owner.user.id);
    expect(remove.status).toBe(403);

    expect(await membershipRole(a.workspace.id, user.user.id)).toBe('USER');
    expect(await membershipRole(a.workspace.id, owner.user.id)).toBe('OWNER');
  });

  it('an ADMIN session can still change roles below OWNER and the change is audit-logged', async () => {
    const { a } = await seedTenantPair();
    const admin = roleUser(a, 'ADMIN');
    const manager = roleUser(a, 'MANAGER');

    const result = await setRole(admin, a.workspace.id, manager.user.id, 'ADMIN');
    expect(result.status).toBe(200);
    expect(dataOf<{ role: string }>(result).role).toBe('ADMIN');

    const log = await prisma.auditLog.findFirst({ where: { workspaceId: a.workspace.id, entityType: 'WorkspaceUser', entityId: manager.user.id } });
    expect(log).toMatchObject({ action: 'UPDATE', userId: admin.user.id });
  });

  it('workspace API keys can never grant or revoke OWNER, even when created by an owner', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const user = roleUser(a, 'USER');
    const key = await seedApiKey(a.workspace.id, owner.user.id, ['USERS_UPDATE', 'USERS_DELETE']);
    const secondOwner = (await seedWorkspace()).users[0]!;
    await prisma.workspaceUser.create({ data: { workspaceId: a.workspace.id, userId: secondOwner.user.id, role: 'OWNER' } });

    const promote = await setRole({ apiKeyJwt: key.jwt }, a.workspace.id, user.user.id, 'OWNER');
    expect(promote.status).toBe(403);
    const demote = await setRole({ apiKeyJwt: key.jwt }, a.workspace.id, secondOwner.user.id, 'ADMIN');
    expect(demote.status).toBe(403);
    const remove = await removeMember({ apiKeyJwt: key.jwt }, a.workspace.id, secondOwner.user.id);
    expect(remove.status).toBe(403);

    // Non-owner changes are still allowed with the scope.
    const ok = await setRole({ apiKeyJwt: key.jwt }, a.workspace.id, user.user.id, 'MANAGER');
    expect(ok.status).toBe(200);

    expect(await membershipRole(a.workspace.id, user.user.id)).toBe('MANAGER');
    expect(await ownerCount(a.workspace.id)).toBe(2);
  });

  it('an OWNER session can grant OWNER and demote another owner, but the last owner is protected', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const admin = roleUser(a, 'ADMIN');

    expect((await setRole(owner, a.workspace.id, admin.user.id, 'OWNER')).status).toBe(200);
    expect(await ownerCount(a.workspace.id)).toBe(2);

    // The new owner demotes the original owner: allowed while another owner remains.
    expect((await setRole(admin, a.workspace.id, owner.user.id, 'ADMIN')).status).toBe(200);
    expect(await ownerCount(a.workspace.id)).toBe(1);

    // The master key may manage owners, but never remove or demote the last one.
    const demoteLast = await setRole('master', a.workspace.id, admin.user.id, 'USER');
    expect(demoteLast.status).toBe(409);
    expect(errorCodeOf(demoteLast)).toBe('LAST_OWNER');
    const removeLast = await removeMember('master', a.workspace.id, admin.user.id);
    expect(removeLast.status).toBe(409);
    expect(await membershipRole(a.workspace.id, admin.user.id)).toBe('OWNER');

    expect((await setRole('master', a.workspace.id, owner.user.id, 'OWNER')).status).toBe(200);
    expect((await removeMember('master', a.workspace.id, admin.user.id)).status).toBe(200);
    expect(await ownerCount(a.workspace.id)).toBe(1);
  });

  it('two owners demoting each other concurrently leave at least one owner', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const admin = roleUser(a, 'ADMIN');
    await prisma.workspaceUser.update({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: admin.user.id } }, data: { role: 'OWNER' } });

    const results = await Promise.all([setRole(owner, a.workspace.id, admin.user.id, 'USER'), setRole(admin, a.workspace.id, owner.user.id, 'USER')]);

    // The loser either hits the last-owner guard or, after a serialization retry, is no longer an owner.
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.map((r) => errorCodeOf(r)).filter(Boolean)).toEqual([expect.stringMatching(/^(LAST_OWNER|OWNER_REQUIRED)$/)]);
    expect(await ownerCount(a.workspace.id)).toBe(1);
  });

  it("returns 404 for another tenant's member and leaves it unchanged", async () => {
    const { a, b } = await seedTenantPair();
    const ownerA = roleUser(a, 'OWNER');
    const userB = roleUser(b, 'USER');

    expect((await setRole(ownerA, a.workspace.id, userB.user.id, 'ADMIN')).status).toBe(404);
    expect((await removeMember(ownerA, a.workspace.id, userB.user.id)).status).toBe(404);
    expect((await setRole('master', a.workspace.id, userB.user.id, 'ADMIN')).status).toBe(404);
    expect(await membershipRole(b.workspace.id, userB.user.id)).toBe('USER');
  });
});

describe('leave', () => {
  it('the last owner cannot leave; other members can', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const user = roleUser(a, 'USER');

    const blocked = await callAs(owner, leaveHandler, { method: 'POST', query: { workspaceId: a.workspace.id } });
    expect(blocked.status).toBe(409);
    expect(errorCodeOf(blocked)).toBe('LAST_OWNER');
    expect(await membershipRole(a.workspace.id, owner.user.id)).toBe('OWNER');

    const left = await callAs(user, leaveHandler, { method: 'POST', query: { workspaceId: a.workspace.id } });
    expect(left.status).toBe(200);
    expect(await membershipRole(a.workspace.id, user.user.id)).toBeNull();
  });

  it('two owners leaving concurrently: exactly one succeeds', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const admin = roleUser(a, 'ADMIN');
    await prisma.workspaceUser.update({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: admin.user.id } }, data: { role: 'OWNER' } });

    const results = await Promise.all([owner, admin].map((caller) => callAs(caller, leaveHandler, { method: 'POST', query: { workspaceId: a.workspace.id } })));

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await ownerCount(a.workspace.id)).toBe(1);
  });
});

describe('join codes', () => {
  it('generates a code server-side when none is sent and validates client codes', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');

    const generated = await callAs(manager, joinCodesHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: {} });
    expect(generated.status).toBe(200);
    expect(dataOf<{ code: string }>(generated).code).toMatch(JOIN_CODE_PATTERN);

    for (const code of ['short', 'has spaces in it', 'x'.repeat(65), 'umlaut-äöü-code']) {
      const invalid = await callAs(manager, joinCodesHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { code } });
      expect(invalid.status, code).toBe(400);
    }
    expect(await prisma.workspaceJoinCode.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
  });

  it('a code taken by another workspace returns 409 CODE_TAKEN', async () => {
    const { a, b } = await seedTenantPair();
    await prisma.workspaceJoinCode.create({ data: { workspaceId: b.workspace.id, code: 'taken-code-123' } });

    const result = await callAs(roleUser(a, 'MANAGER'), joinCodesHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { code: 'taken-code-123' },
    });
    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('CODE_TAKEN');
    expect(await prisma.workspaceJoinCode.findUnique({ where: { code: 'taken-code-123' } })).toMatchObject({ workspaceId: b.workspace.id });
  });

  it("deleting another workspace's code returns 404 and keeps it", async () => {
    const { a, b } = await seedTenantPair();
    await prisma.workspaceJoinCode.create({ data: { workspaceId: b.workspace.id, code: 'tenant-b-code' } });

    const result = await callAs(roleUser(a, 'OWNER'), joinCodeItemHandler, {
      method: 'DELETE',
      query: { workspaceId: a.workspace.id, code: 'tenant-b-code' },
    });
    expect(result.status).toBe(404);
    expect(await prisma.workspaceJoinCode.count({ where: { code: 'tenant-b-code' } })).toBe(1);
  });
});

describe('join', () => {
  const join = (caller: Parameters<typeof callAs>[0], code?: string) =>
    callAs(caller, joinHandler, { method: 'POST', query: code === undefined ? {} : { code } });

  it('20 concurrent joins with a one-time code create exactly one join request', async () => {
    const { a } = await seedTenantPair();
    await prisma.workspaceJoinCode.create({ data: { workspaceId: a.workspace.id, code: 'one-time-code', onlyUseOnce: true } });
    const joiners = [];
    for (let i = 0; i < 20; i++) joiners.push(await seedSessionUser(`Joiner ${i}`));

    const results = await Promise.all(joiners.map((joiner) => join(joiner, 'one-time-code')));

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400 && errorCodeOf(r) === 'INVALID_JOIN_CODE')).toHaveLength(19);
    expect(await prisma.workspaceJoinRequest.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    expect(await prisma.workspaceJoinCode.findUnique({ where: { code: 'one-time-code' } })).toMatchObject({ used: 1 });
  });

  it('concurrent first joins of an empty workspace create exactly one owner', async () => {
    const empty = await prisma.workspace.create({ data: { name: 'Empty' } });
    await prisma.workspaceJoinCode.create({ data: { workspaceId: empty.id, code: 'bootstrap-code' } });
    const joiners = [];
    for (let i = 0; i < 5; i++) joiners.push(await seedSessionUser(`Founder ${i}`));

    const results = await Promise.all(joiners.map((joiner) => join(joiner, 'bootstrap-code')));

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await prisma.workspaceUser.count({ where: { workspaceId: empty.id } })).toBe(1);
    expect(await ownerCount(empty.id)).toBe(1);
    expect(await prisma.workspaceJoinCode.count({ where: { workspaceId: empty.id } })).toBe(0);
  });

  it('reports member / already-requested / invalid / expired codes with error codes', async () => {
    const { a } = await seedTenantPair();
    await prisma.workspaceJoinCode.create({ data: { workspaceId: a.workspace.id, code: 'reusable-code' } });
    await prisma.workspaceJoinCode.create({ data: { workspaceId: a.workspace.id, code: 'expired-code', expires: new Date(Date.now() - 1000) } });
    const outsider = await seedSessionUser();

    expect(errorCodeOf(await join(roleUser(a, 'USER'), 'reusable-code'))).toBe('ALREADY_IN_WORKSPACE');
    expect((await join(outsider, 'reusable-code')).status).toBe(200);
    const again = await join(outsider, 'reusable-code');
    expect(again.status).toBe(400);
    expect(errorCodeOf(again)).toBe('JOIN_ALREADY_REQUESTED');
    expect(errorCodeOf(await join(outsider, 'expired-code'))).toBe('INVALID_JOIN_CODE');
    expect(errorCodeOf(await join(outsider, 'does-not-exist'))).toBe('INVALID_JOIN_CODE');
    expect(errorCodeOf(await join(outsider))).toBe('VALIDATION_ERROR');
    expect(errorCodeOf(await join(outsider, 'x'.repeat(65)))).toBe('VALIDATION_ERROR');

    expect(await prisma.workspaceJoinCode.findUnique({ where: { code: 'reusable-code' } })).toMatchObject({ used: 1 });
    expect(await prisma.workspaceJoinRequest.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
  });

  it('rate-limits join attempts per user, rejects anonymous callers and other methods', async () => {
    const outsider = await seedSessionUser();
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await join(outsider, `guess-${i}-code`)).status);
    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses[10]).toBe(429);

    expect((await join('anonymous', 'whatever-code')).status).toBe(401);
    expect((await callAs(outsider, joinHandler, { method: 'GET', query: { code: 'whatever-code' } })).status).toBe(405);
  });
});

describe('join requests', () => {
  it('concurrent accepts add the member exactly once; the others get 404', async () => {
    const { a } = await seedTenantPair();
    const applicant = await seedSessionUser();
    await prisma.workspaceJoinRequest.create({ data: { workspaceId: a.workspace.id, userId: applicant.user.id } });
    const manager = roleUser(a, 'MANAGER');

    const results = await Promise.all(
      Array.from({ length: 10 }, () => callAs(manager, acceptHandler, { method: 'POST', query: { workspaceId: a.workspace.id, userId: applicant.user.id } })),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 404)).toHaveLength(9);
    expect(await membershipRole(a.workspace.id, applicant.user.id)).toBe('USER');
    expect(await prisma.workspaceJoinRequest.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });

  it("cannot accept or reject another tenant's join request", async () => {
    const { a, b } = await seedTenantPair();
    const applicant = await seedSessionUser();
    await prisma.workspaceJoinRequest.create({ data: { workspaceId: b.workspace.id, userId: applicant.user.id } });
    const ownerA = roleUser(a, 'OWNER');

    for (const handler of [acceptHandler, rejectHandler]) {
      const result = await callAs(ownerA, handler, { method: 'POST', query: { workspaceId: a.workspace.id, userId: applicant.user.id } });
      expect(result.status).toBe(404);
    }
    expect(await prisma.workspaceJoinRequest.count({ where: { workspaceId: b.workspace.id, userId: applicant.user.id } })).toBe(1);
    expect(await membershipRole(a.workspace.id, applicant.user.id)).toBeNull();
  });

  it('lists requests with a slim user ref and lets the (non-member) applicant withdraw their own request', async () => {
    const { a } = await seedTenantPair();
    const applicant = await seedSessionUser();
    await prisma.workspaceJoinRequest.create({ data: { workspaceId: a.workspace.id, userId: applicant.user.id } });

    const list = await callAs(roleUser(a, 'MANAGER'), joinRequestsHandler, { method: 'GET', query: { workspaceId: a.workspace.id } });
    expect(list.status).toBe(200);
    expect(Object.keys(dataOf<Array<{ user: object }>>(list)[0]!.user).sort()).toEqual(['email', 'id', 'image', 'name']);

    // The applicant is not a member, yet can withdraw their own request (session only).
    expect((await callAs({ apiKeyJwt: 'not-a-key' }, joinRequestsHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } })).status).toBe(401);
    const withdraw = await callAs(applicant, joinRequestsHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } });
    expect(withdraw.status).toBe(200);
    expect(dataOf(withdraw)).toEqual({ count: 1 });
    const again = await callAs(applicant, joinRequestsHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } });
    expect(again.status).toBe(404);
    expect(await prisma.workspaceJoinRequest.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });
});
