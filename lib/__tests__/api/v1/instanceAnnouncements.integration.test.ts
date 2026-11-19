/**
 * Announcements of the control plane: the push `PUT /api/v1/instance/announcements` (master key only, audit,
 * idempotency) and the banner reads, which target all workspaces or the listed ones within a time window.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { collectionHandler, instanceAnnouncementsHandler, workspaceCollectionHandler } from '@lib/api/v1/announcements';
import { instanceHandler } from '@lib/api/v1/instance';
import { AnnouncementDtoSchema, AnnouncementsPutResultSchema, MAX_ANNOUNCEMENTS, type AnnouncementDto } from '@lib/schemas/announcements';
import { bearerToken, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace, type SeededUser } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf } from '@test/helpers/scenario';
import type { HandlerResult } from '@test/helpers/invokeHandler';

type Announcement = Record<string, unknown>;

const text = (de: string, en: string = de) => ({ de, en });

const announcement = (overrides: Announcement = {}): Announcement => ({
  id: 'a1',
  level: 'info',
  body: text('Wartung am Sonntag', 'Maintenance on Sunday'),
  workspaceIds: [],
  ...overrides,
});

const put = (announcements: unknown, headers: Record<string, string> = {}) =>
  callAs('master', instanceAnnouncementsHandler, { method: 'PUT', body: { announcements }, headers });

async function pushed(announcements: Announcement[], headers: Record<string, string> = {}): Promise<void> {
  const result = await put(announcements, headers);
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  expect(AnnouncementsPutResultSchema.strict().parse(dataOf(result))).toEqual({ count: announcements.length });
}

function listOf(result: HandlerResult): AnnouncementDto[] {
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return dataOf<unknown[]>(result).map((item) => AnnouncementDtoSchema.strict().parse(item));
}

const forOverview = async (user: SeededUser) => listOf(await callAs(user, collectionHandler, { method: 'GET' }));
const forWorkspace = async (user: SeededUser, workspaceId: string) =>
  listOf(await callAs(user, workspaceCollectionHandler, { method: 'GET', query: { workspaceId } }));
const idsOf = (items: AnnouncementDto[]) => items.map((item) => item.id);

const minutes = (offset: number) => new Date(Date.now() + offset * 60_000).toISOString();

describe('PUT /api/v1/instance/announcements', () => {
  it('replaces the full set and stores texts per language', async () => {
    await pushed([announcement({ id: 'old' })]);
    await pushed([
      announcement({ id: 'untitled', body: text('  Nur Text  ', 'Text only') }),
      announcement({ id: 'titled', level: 'warning', title: text('Wartung', 'Maintenance'), body: text('Sonntag ab 22 Uhr', 'Sunday from 10 pm') }),
    ]);

    const rows = await prisma.instanceAnnouncement.findMany({ orderBy: { id: 'asc' } });
    expect(rows.map((row) => row.id)).toEqual(['titled', 'untitled']);
    expect(rows[0]).toMatchObject({
      level: 'warning',
      title: { de: 'Wartung', en: 'Maintenance' },
      body: { de: 'Sonntag ab 22 Uhr', en: 'Sunday from 10 pm' },
      startsAt: null,
      endsAt: null,
      workspaceIds: [],
    });
    expect(rows[1]).toMatchObject({ level: 'info', title: null, body: { de: 'Nur Text', en: 'Text only' } });
  });

  it('removes all announcements with an empty array', async () => {
    await pushed([announcement()]);
    await pushed([]);
    expect(await prisma.instanceAnnouncement.count()).toBe(0);
  });

  it('rejects invalid input and keeps the current set', async () => {
    await pushed([announcement({ id: 'kept' })]);
    const invalid: Array<[string, unknown]> = [
      ['no array', 'nope'],
      ['missing body', [{ id: 'a', level: 'info', workspaceIds: [] }]],
      ['body as string', [announcement({ body: 'Maintenance' })]],
      ['body as JSON string', [announcement({ body: '{"de":"Wartung","en":"Maintenance"}' })]],
      ['body without en', [announcement({ body: { de: 'Wartung' } })]],
      ['body without de', [announcement({ body: { en: 'Maintenance' } })]],
      ['empty de', [announcement({ body: text('', 'Maintenance') })]],
      ['blank en', [announcement({ body: text('Wartung', '   ') })]],
      ['body text no string', [announcement({ body: { de: 1, en: 'Maintenance' } })]],
      ['title as string', [announcement({ title: 'Heads up' })]],
      ['title without en', [announcement({ title: { de: 'Hinweis' } })]],
      ['empty title text', [announcement({ title: text('Hinweis', '') })]],
      ['missing workspaceIds', [{ id: 'a', level: 'info', body: text('x') }]],
      ['missing id', [{ level: 'info', body: text('x'), workspaceIds: [] }]],
      ['unknown level', [announcement({ level: 'urgent' })]],
      ['uppercase level', [announcement({ level: 'INFO' })]],
      ['capitalized level', [announcement({ level: 'Critical' })]],
      ['missing level', [{ id: 'a', body: text('x'), workspaceIds: [] }]],
      ['body too long', [announcement({ body: text('x', 'x'.repeat(2001)) })]],
      ['title too long', [announcement({ title: text('x'.repeat(201), 'x') })]],
      ['invalid startsAt', [announcement({ startsAt: 'tomorrow' })]],
      ['endsAt before startsAt', [announcement({ startsAt: minutes(10), endsAt: minutes(5) })]],
      ['duplicate ids', [announcement({ id: 'dup' }), announcement({ id: 'dup' })]],
      ['too many announcements', Array.from({ length: MAX_ANNOUNCEMENTS + 1 }, (_, index) => announcement({ id: `a${index}` }))],
    ];
    for (const [name, announcements] of invalid) {
      const result = await put(announcements);
      expect(result.status, name).toBe(400);
      expect(errorCodeOf(result), name).toBe('VALIDATION_ERROR');
    }
    const missing = await callAs('master', instanceAnnouncementsHandler, { method: 'PUT', body: {} });
    expect(missing.status).toBe(400);

    expect((await prisma.instanceAnnouncement.findMany()).map((row) => row.id)).toEqual(['kept']);
    expect(await prisma.instanceAuditLog.count()).toBe(1);
  });

  it('answers 401 without the master key and changes nothing', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const apiKey = await seedApiKey(seeded.workspace.id, owner.user.id, ['WORKSPACE_READ', 'WORKSPACE_UPDATE']);
    for (const [who, headers] of [
      ['no key', {}],
      ['wrong key', bearerToken('ck_master_wrong')],
      ['owner session', sessionCookie(owner.sessionToken)],
      ['workspace api key', bearerToken(apiKey.jwt)],
    ] as const) {
      const result = await callAs('anonymous', instanceAnnouncementsHandler, {
        method: 'PUT',
        body: { announcements: [announcement()] },
        headers: { ...headers },
      });
      expect(result.status, who).toBe(401);
      expect(errorCodeOf(result), who).toBe('UNAUTHORIZED');
    }
    expect(await prisma.instanceAnnouncement.count()).toBe(0);
    expect(await prisma.instanceAuditLog.count()).toBe(0);
  });

  it('answers 405 for other methods', async () => {
    expect((await callAs('master', instanceAnnouncementsHandler, { method: 'GET' })).status).toBe(405);
    expect((await callAs('master', instanceAnnouncementsHandler, { method: 'DELETE' })).status).toBe(405);
  });

  it('writes an audit entry with actor, reason and what was replaced', async () => {
    await pushed([announcement({ id: 'first' })]);
    await pushed([announcement({ id: 'second', level: 'critical', workspaceIds: ['w1', 'w2'] })], {
      'x-cm-actor': 'admin@example.test',
      'x-cm-reason': 'Planned maintenance',
    });

    const entries = await prisma.instanceAuditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      action: 'announcements.replace',
      targetType: 'instance',
      targetId: null,
      actor: null,
      reason: null,
      idempotencyKey: null,
    });
    expect(entries[1]).toMatchObject({
      action: 'announcements.replace',
      targetType: 'instance',
      actor: 'admin@example.test',
      reason: 'Planned maintenance',
      response: { count: 1 },
      details: { previousIds: ['first'], announcements: [{ id: 'second', level: 'critical', workspaces: 2 }] },
    });
  });

  it('replays the answer for a retry with the same Idempotency-Key', async () => {
    const key = randomUUID();
    const set = [announcement({ id: 'once' })];
    await pushed(set, { 'idempotency-key': key });
    // Another push in between: the retry must not bring the old set back.
    await pushed([announcement({ id: 'newer' }), announcement({ id: 'newest' })]);

    const retry = await put(set, { 'idempotency-key': key.toUpperCase() });
    expect(retry.status).toBe(200);
    expect(dataOf(retry)).toEqual({ count: 1 });
    expect((await prisma.instanceAnnouncement.findMany({ orderBy: { id: 'asc' } })).map((row) => row.id)).toEqual(['newer', 'newest']);
    expect(await prisma.instanceAuditLog.count()).toBe(2);
  });

  it('refuses a reused Idempotency-Key with another request and invalid headers', async () => {
    const key = randomUUID();
    await pushed([announcement({ id: 'once' })], { 'idempotency-key': key });

    const reused = await put([announcement({ id: 'other' })], { 'idempotency-key': key });
    expect(reused.status).toBe(409);
    expect(errorCodeOf(reused)).toBe('IDEMPOTENCY_KEY_REUSED');

    const invalidHeaders: Array<Record<string, string>> = [
      { 'idempotency-key': 'not-a-uuid' },
      { 'x-cm-actor': 'a'.repeat(255) },
      { 'x-cm-reason': 'r'.repeat(501) },
    ];
    for (const headers of invalidHeaders) {
      const result = await put([announcement({ id: 'other' })], headers);
      expect(result.status, JSON.stringify(headers)).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
    }
    expect((await prisma.instanceAnnouncement.findMany()).map((row) => row.id)).toEqual(['once']);
    expect(await prisma.instanceAuditLog.count()).toBe(1);
  });

  it('applies concurrent pushes with the same key once', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => put([announcement({ id: 'race' })], { 'idempotency-key': key })));
    for (const result of results) {
      expect(result.status, JSON.stringify(result.json)).toBe(200);
      expect(dataOf(result)).toEqual({ count: 1 });
    }
    expect(await prisma.instanceAuditLog.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(await prisma.instanceAnnouncement.count()).toBe(1);
  });
});

describe('banner reads', () => {
  it('shows announcements for all workspaces everywhere and listed ones only in their workspaces', async () => {
    const a = await seedWorkspace({ users: [{ role: 'USER' }] });
    const b = await seedWorkspace({ users: [{ role: 'USER' }] });
    const userA = findUserByRole(a, 'USER');
    const userB = findUserByRole(b, 'USER');
    await pushed([
      announcement({ id: 'all' }),
      announcement({ id: 'only-a', workspaceIds: [a.workspace.id] }),
      announcement({ id: 'a-and-b', workspaceIds: [a.workspace.id, b.workspace.id, 'unknown-workspace'] }),
      announcement({ id: 'unknown', workspaceIds: ['unknown-workspace'] }),
    ]);

    expect(idsOf(await forWorkspace(userA, a.workspace.id)).sort()).toEqual(['a-and-b', 'all', 'only-a']);
    expect(idsOf(await forWorkspace(userB, b.workspace.id)).sort()).toEqual(['a-and-b', 'all']);
    expect(idsOf(await forOverview(userA))).toEqual(['all']);
  });

  it('shows announcements only within their time window', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
    const user = findUserByRole(seeded, 'USER');
    await pushed([
      announcement({ id: 'open' }),
      announcement({ id: 'running', startsAt: minutes(-10), endsAt: minutes(10) }),
      announcement({ id: 'started', startsAt: minutes(-10) }),
      announcement({ id: 'ending', endsAt: minutes(10) }),
      announcement({ id: 'future', startsAt: minutes(10) }),
      announcement({ id: 'over', startsAt: minutes(-20), endsAt: minutes(-10) }),
      announcement({ id: 'ended', endsAt: minutes(-1) }),
    ]);

    const expected = ['ending', 'open', 'running', 'started'];
    expect(idsOf(await forWorkspace(user, seeded.workspace.id)).sort()).toEqual(expected);
    expect(idsOf(await forOverview(user)).sort()).toEqual(expected);
  });

  it('answers the texts per language, most severe first, and only info is dismissible', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
    const user = findUserByRole(seeded, 'USER');
    const endsAt = minutes(60);
    await pushed([
      announcement({ id: 'i', level: 'info', title: text('Hinweis', 'Notice'), body: text('Neu', 'New'), endsAt }),
      announcement({ id: 'c', level: 'critical', body: text('Ausfall', 'Outage') }),
      announcement({ id: 'w', level: 'warning', body: text('Langsam', 'Slow') }),
    ]);

    const items = await forWorkspace(user, seeded.workspace.id);
    expect(items.map((item) => [item.id, item.level, item.dismissible])).toEqual([
      ['c', 'critical', false],
      ['w', 'warning', false],
      ['i', 'info', true],
    ]);
    expect(items[2]).toMatchObject({ title: { de: 'Hinweis', en: 'Notice' }, body: { de: 'Neu', en: 'New' }, endsAt });
    expect(items[0]).toMatchObject({ title: null, body: { de: 'Ausfall', en: 'Outage' }, endsAt: null });
  });

  it('changes the revision when the announcement changes, so a dismissed one shows again', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
    const user = findUserByRole(seeded, 'USER');
    await pushed([announcement({ id: 'a', body: text('Erste', 'First') })]);
    const [first] = await forOverview(user);
    await pushed([announcement({ id: 'a', body: text('Erste', 'First') })]);
    const [same] = await forOverview(user);
    await pushed([announcement({ id: 'a', body: text('Erste', 'Second') })]);
    const [changed] = await forOverview(user);

    expect(same.revision).toBe(first.revision);
    expect(changed.revision).not.toBe(first.revision);
  });

  it('needs a session, and membership for the workspace read', async () => {
    const a = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const b = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const ownerA = findUserByRole(a, 'OWNER');
    const apiKey = await seedApiKey(a.workspace.id, ownerA.user.id, ['WORKSPACE_READ']);
    await pushed([announcement({ id: 'all' }), announcement({ id: 'only-b', workspaceIds: [b.workspace.id] })]);

    expect((await callAs('anonymous', collectionHandler, { method: 'GET' })).status).toBe(401);
    expect((await callAs('anonymous', workspaceCollectionHandler, { method: 'GET', query: { workspaceId: a.workspace.id } })).status).toBe(401);
    expect((await callAs({ apiKeyJwt: apiKey.jwt }, workspaceCollectionHandler, { method: 'GET', query: { workspaceId: a.workspace.id } })).status).not.toBe(
      200,
    );
    expect((await callAs('master', collectionHandler, { method: 'GET' })).status).not.toBe(200);

    const foreign = await callAs(ownerA, workspaceCollectionHandler, { method: 'GET', query: { workspaceId: b.workspace.id } });
    expect(foreign.status).not.toBe(200);
    expect(JSON.stringify(foreign.json)).not.toContain('only-b');
  });

  it('is empty without a push (self-hosted instance)', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
    const user = findUserByRole(seeded, 'USER');
    expect(await forOverview(user)).toEqual([]);
    expect(await forWorkspace(user, seeded.workspace.id)).toEqual([]);
  });
});

describe('capabilities', () => {
  const capabilities = async () => dataOf<{ capabilities: string[] }>(await callAs('master', instanceHandler, { method: 'GET' })).capabilities;

  it('advertises announcements and support.write only in managed mode', async () => {
    const original = process.env.ENTITLEMENTS_MODE;
    try {
      delete process.env.ENTITLEMENTS_MODE;
      expect(await capabilities()).toEqual(['instance.read']);
      process.env.ENTITLEMENTS_MODE = 'off';
      expect(await capabilities()).toEqual(['instance.read']);
      process.env.ENTITLEMENTS_MODE = 'managed';
      expect(await capabilities()).toEqual(expect.arrayContaining(['instance.read', 'announcements', 'support.write']));
    } finally {
      if (original === undefined) delete process.env.ENTITLEMENTS_MODE;
      else process.env.ENTITLEMENTS_MODE = original;
    }
  });
});
