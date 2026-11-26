/**
 * Entitlements (docs/ENTITLEMENTS.md): snapshot pushes of the control plane, the guards at every write path, the
 * workspace status and `ENTITLEMENTS_MODE=off` (pushed snapshots have no effect).
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@generated/prisma/client';
import prisma from '../../../../prisma/prisma';
import { instanceDefaultHandler, instanceWorkspaceHandler, workspaceHandler as entitlementHandler } from '@lib/api/v1/entitlements';
import { instanceHandler, workspacesCollectionHandler, workspacesItemHandler } from '@lib/api/v1/instance';
import {
  cloneHandler,
  collectionHandler as cocktailsHandler,
  exportJsonHandler as cocktailsExportHandler,
  importJsonHandler as cocktailsImportHandler,
  archiveHandler,
  unarchiveHandler,
} from '@lib/api/v1/cocktails';
import {
  collectionHandler as calculationsHandler,
  exportJsonHandler as calculationsExportHandler,
  importJsonHandler as calculationsImportHandler,
} from '@lib/api/v1/calculations';
import { translationsCollectionHandler } from '@lib/api/v1/translations';
import {
  collectionHandler as announcementsHandler,
  instanceAnnouncementsHandler,
  workspaceCollectionHandler as workspaceAnnouncementsHandler,
} from '@lib/api/v1/announcements';
import { exportHtmlHandler as guestMenuHtmlHandler, itemHandler as guestMenuItemHandler } from '@lib/api/v1/guestMenus';
import { itemHandler as cocktailItemHandler } from '@lib/api/v1/cocktails';
import pg from 'pg';
import { collectionHandler as guestMenusHandler, publishHandler } from '@lib/api/v1/guestMenus';
import { signageHandler, slidesHandler } from '@lib/api/v1/signage';
import { collectionHandler as apiKeysHandler } from '@lib/api/v1/apiKeys';
import { overviewHandler } from '@lib/api/v1/statisticsAdvanced';
import { acceptHandler } from '@lib/api/v1/joinRequests';
import { applyHandler } from '@lib/api/v1/templates';
import { leaveHandler } from '@lib/api/v1/leave';
import { itemHandler as workspaceItemHandler } from '@lib/api/v1/workspace';
import joinHandler from '@lib/api/v1/join';
import backupExportHandler from '@lib/backup/exportHandler';
import backupImportHandler from '@lib/backup/importHandler';
import workspacesHandler from '../../../../pages/api/v1/workspaces/index';
import adminWorkspaceHandler from '../../../../pages/api/admin/workspace';
import publicSignageHandler from '../../../../pages/api/signage/[id]';
import { createWorkspace } from '@lib/templates/createWorkspace';
import { buildTableTentHtml } from '@lib/guest-menu/print/print.server';
import { loadPublicMenu } from '@lib/guest-menu/public.server';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import publicMenusHandler from '../../../../pages/api/public/menus/[...slug]';
import publicImagesHandler from '../../../../pages/api/public/images/[workspaceSlug]/[kind]/[id]';
import { EntitlementApplyResultSchema, WorkspaceEntitlementDtoSchema, type WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { InstanceInfoSchema, InstanceWorkspaceDetailSchema, type InstanceWorkspaceSummaryDto } from '@lib/schemas/instance';
import type { SnapshotWire } from '@lib/entitlements/snapshot';
import { UNLIMITED, snapshotWire } from '@test/helpers/entitlements';
import { seedApiKey, seedCocktail, seedGlass, seedWorkspace, type SeededWorkspace } from '@test/helpers/dbFixtures';
import { calculationExportItem, seedCalculation, seedContent } from '@test/helpers/fixtures/g3';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair, type Caller } from '@test/helpers/scenario';
import type { HandlerResult } from '@test/helpers/invokeHandler';

const writeHeaders = (overrides: Record<string, string> = {}) => ({
  'x-cm-actor': 'admin@control-plane.test',
  'x-cm-reason': 'plan change',
  'idempotency-key': randomUUID(),
  ...overrides,
});

const pushDefault = (snapshot: unknown, headers: Record<string, string> = writeHeaders()) =>
  callAs('master', instanceDefaultHandler, { method: 'PUT', body: snapshot, headers });
const pushWorkspace = (id: string, snapshot: unknown, headers: Record<string, string> = writeHeaders()) =>
  callAs('master', instanceWorkspaceHandler, { method: 'PUT', query: { id }, body: snapshot, headers });

function applyResult(result: HandlerResult) {
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return EntitlementApplyResultSchema.strict().parse(dataOf(result));
}

/** Pushes a workspace snapshot with the given limits (others unlimited) and features. */
async function plan(workspaceId: string, limits: Partial<SnapshotWire['limits']>, options: Partial<SnapshotWire> = {}) {
  const current = await prisma.workspaceEntitlement.findUnique({ where: { workspaceId } });
  const snapshot = snapshotWire({ planKey: 'test_plan', features: [], ...options, limits: { ...UNLIMITED, ...limits }, version: (current?.version ?? 0) + 1 });
  applyResult(await pushWorkspace(workspaceId, snapshot));
  return snapshot;
}

function expectPlanError(result: HandlerResult, code: string, details?: { key: string; limit: number | null; current: number | null }) {
  expect(result.status, JSON.stringify(result.json)).toBe(402);
  expect(errorCodeOf(result)).toBe(code);
  if (details) expect((result.json as { error: { issues: unknown } }).error.issues).toEqual(details);
}

const managed = () => vi.stubEnv('ENTITLEMENTS_MODE', 'managed');

/** Ids of rows created per run and timestamps (visits, export dates) differ between two runs; everything else must not. */
function normalizeVolatile<T>(value: T): T {
  const walk = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)]));
    if (typeof item === 'string') {
      return item
        .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)/g, '<timestamp>')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '<uuid>');
    }
    return item;
  };
  return walk(value) as T;
}

/** 1×1 PNG as stored in `Workspace.image`. */
const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Push endpoints
// ---------------------------------------------------------------------------

describe('PUT /api/v1/instance/workspaces/{id}/entitlements', () => {
  it('applies only higher versions and answers with the current version and hash', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const v1 = snapshotWire({ version: 1 });
    const v1Other = snapshotWire({ version: 1, planKey: 'other' });
    const v2 = snapshotWire({ version: 2, planKey: 'bar_pro' });

    expect(applyResult(await pushWorkspace(workspace.id, v1))).toEqual({ applied: true, currentVersion: 1, currentHash: v1.hash });
    expect(applyResult(await pushWorkspace(workspace.id, v1Other))).toEqual({ applied: false, currentVersion: 1, currentHash: v1.hash });
    expect(applyResult(await pushWorkspace(workspace.id, v2))).toEqual({ applied: true, currentVersion: 2, currentHash: v2.hash });
    expect(applyResult(await pushWorkspace(workspace.id, v1Other))).toEqual({ applied: false, currentVersion: 2, currentHash: v2.hash });

    const stored = await prisma.workspaceEntitlement.findUniqueOrThrow({ where: { workspaceId: workspace.id } });
    expect(stored).toMatchObject({ version: 2, hash: v2.hash, snapshot: v2 });
  });

  it('writes actor and reason of every applied snapshot to the audit log', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await pushWorkspace(workspace.id, snapshotWire({ version: 1 }), writeHeaders({ 'x-cm-reason': 'initial' }));
    await pushWorkspace(workspace.id, snapshotWire({ version: 1, planKey: 'ignored' }));
    await pushWorkspace(workspace.id, snapshotWire({ version: 2, planKey: 'bar_pro', status: 'GRACE' }), writeHeaders({ 'x-cm-reason': 'payment failed' }));

    const logs = await prisma.auditLog.findMany({ where: { workspaceId: workspace.id, entityType: 'WorkspaceEntitlement' }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((log) => log.action)).toEqual(['CREATE', 'UPDATE']);
    const instanceLogs = await prisma.instanceAuditLog.findMany({
      where: { action: 'entitlements.workspace', targetId: workspace.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(instanceLogs.map((log) => [log.reason, (log.response as { applied: boolean }).applied])).toEqual([
      ['initial', true],
      ['plan change', false],
      ['payment failed', true],
    ]);
    expect(logs[1]).toMatchObject({
      userId: null,
      entityId: workspace.id,
      changes: { from: { version: 1, planKey: 'homebar_free', status: 'ACTIVE' } },
      snapshot: { version: 2, planKey: 'bar_pro', status: 'GRACE', controlPlane: { actor: 'admin@control-plane.test', reason: 'payment failed' } },
    });
  });

  it('honours Idempotency-Key: a retry gets the stored response, another body with the same key is refused', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const headers = writeHeaders();
    const v1 = snapshotWire({ version: 1 });

    const first = applyResult(await pushWorkspace(workspace.id, v1, headers));
    const retry = applyResult(await pushWorkspace(workspace.id, v1, headers));
    expect(retry).toEqual(first);
    expect(retry.applied).toBe(true);
    expect(await prisma.auditLog.count({ where: { workspaceId: workspace.id, entityType: 'WorkspaceEntitlement' } })).toBe(1);

    const otherBody = await pushWorkspace(workspace.id, snapshotWire({ version: 2 }), headers);
    expect(otherBody.status).toBe(409);
    expect(errorCodeOf(otherBody)).toBe('IDEMPOTENCY_KEY_REUSED');
    const otherWorkspace = await pushWorkspace(other.workspace.id, v1, headers);
    expect(otherWorkspace.status).toBe(409);
    expect(errorCodeOf(otherWorkspace)).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.workspaceEntitlement.findUnique({ where: { workspaceId: other.workspace.id } })).toBeNull();

    // Parallel requests with one key write once.
    const parallelKey = writeHeaders();
    const v3 = snapshotWire({ version: 3 });
    const results = await Promise.all(Array.from({ length: 5 }, () => pushWorkspace(workspace.id, v3, parallelKey)));
    expect(results.map((result) => applyResult(result))).toEqual(Array.from({ length: 5 }, () => ({ applied: true, currentVersion: 3, currentHash: v3.hash })));
    expect(await prisma.auditLog.count({ where: { workspaceId: workspace.id, entityType: 'WorkspaceEntitlement' } })).toBe(2);
  });

  it('validates the snapshot strictly and the control plane headers', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const valid = snapshotWire();
    for (const body of [
      { ...valid, version: 0 },
      { ...valid, hash: 'xyz' },
      { ...valid, limits: { ...valid.limits, cocktails: 'many' } },
      { ...valid, limits: { cocktails: 1 } },
      { ...valid, status: 'DELETED' },
      undefined,
    ]) {
      const result = await pushWorkspace(workspace.id, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
    }
    const badKey = await pushWorkspace(workspace.id, valid, writeHeaders({ 'idempotency-key': 'not-a-uuid' }));
    expect(badKey.status).toBe(400);
    expect(await prisma.workspaceEntitlement.count()).toBe(0);
  });

  it('ignores unknown fields and limit keys of newer control planes and keeps their hash', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const valid = snapshotWire();
    const result = await pushWorkspace(workspace.id, { ...valid, upcoming: { x: 1 }, limits: { ...valid.limits, freeWorkspacesPerOwner: 1 } });
    expect(applyResult(result)).toEqual({ applied: true, currentVersion: 1, currentHash: valid.hash });
    const stored = await prisma.workspaceEntitlement.findUniqueOrThrow({ where: { workspaceId: workspace.id } });
    expect(stored).toMatchObject({ hash: valid.hash, snapshot: valid });
  });

  it('answers 404 for an unknown workspace and 401 without the master key', async () => {
    expect((await pushWorkspace('missing', snapshotWire())).status).toBe(404);
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const key = await seedApiKey(workspace.id, users[0]!.user.id, ['WORKSPACE_READ']);
    for (const caller of ['anonymous', users[0]!, { apiKeyJwt: key.jwt }] as Caller[]) {
      const result = await callAs(caller, instanceWorkspaceHandler, { method: 'PUT', query: { id: workspace.id }, body: snapshotWire() });
      expect(result.status).toBe(401);
      expect((await callAs(caller, instanceDefaultHandler, { method: 'PUT', body: snapshotWire() })).status).toBe(401);
    }
  });
});

describe('scheduledEnd (cancelled subscription)', () => {
  const scheduledEnd = { at: '2026-12-31T23:59:59.000Z', planKey: 'homebar_free', planName: { de: 'Homebar Free', en: 'Homebar Free' } };
  const get = async (caller: Caller, workspaceId: string) => {
    const result = await callAs(caller, entitlementHandler, { method: 'GET', query: { workspaceId } });
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    return WorkspaceEntitlementDtoSchema.strict().parse(dataOf(result));
  };

  it('is stored with the snapshot and returned by the plan endpoint: set, moved, cleared and missing', async () => {
    managed();
    const { a } = await seedTenantPair();
    const user = roleUser(a, 'USER');
    const pro = { planKey: 'bar_pro', planName: { de: 'Bar Pro', en: 'Bar Pro' } };

    // Older control planes do not send the field.
    const v1 = snapshotWire({ ...pro, version: 1 });
    expect(v1).not.toHaveProperty('scheduledEnd');
    applyResult(await pushWorkspace(a.workspace.id, v1));
    expect((await get(user, a.workspace.id)).plan).toMatchObject({ planKey: 'bar_pro', scheduledEnd: null });

    const v2 = snapshotWire({ ...pro, version: 2, nextChangeAt: scheduledEnd.at, scheduledEnd });
    expect(applyResult(await pushWorkspace(a.workspace.id, v2))).toEqual({ applied: true, currentVersion: 2, currentHash: v2.hash });
    const stored = await prisma.workspaceEntitlement.findUniqueOrThrow({ where: { workspaceId: a.workspace.id } });
    expect(stored.snapshot).toEqual(v2);
    expect((await get(user, a.workspace.id)).plan).toMatchObject({ planKey: 'bar_pro', nextChangeAt: scheduledEnd.at, scheduledEnd });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { workspaceId: a.workspace.id, entityType: 'WorkspaceEntitlement' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.snapshot).toMatchObject({ version: 2, scheduledEnd });

    const moved = { ...scheduledEnd, at: '2027-01-31T23:59:59.000Z' };
    applyResult(await pushWorkspace(a.workspace.id, snapshotWire({ ...pro, version: 3, nextChangeAt: moved.at, scheduledEnd: moved })));
    expect((await get(user, a.workspace.id)).plan!.scheduledEnd).toEqual(moved);

    // Reactivated.
    applyResult(await pushWorkspace(a.workspace.id, snapshotWire({ ...pro, version: 4, scheduledEnd: null })));
    expect((await get(user, a.workspace.id)).plan).toMatchObject({ nextChangeAt: null, scheduledEnd: null });
  });

  it('is accepted by the default push as well', async () => {
    managed();
    const { a } = await seedTenantPair();
    const snapshot = snapshotWire({ scheduledEnd });
    applyResult(await pushDefault(snapshot));
    const stored = await prisma.instanceSetting.findUniqueOrThrow({ where: { key: 'entitlements.default' } });
    expect(stored.value).toEqual({ snapshot });
    expect((await get(roleUser(a, 'USER'), a.workspace.id)).plan).toMatchObject({ source: 'default', scheduledEnd });
  });

  it('is refused with 400 when wrongly typed, nothing is stored', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const valid = snapshotWire();
    for (const value of [
      '2026-12-31T23:59:59.000Z',
      {},
      { ...scheduledEnd, at: 'soon' },
      { ...scheduledEnd, at: null },
      { ...scheduledEnd, planKey: 7 },
      { at: scheduledEnd.at, planKey: scheduledEnd.planKey },
      { ...scheduledEnd, planName: { de: 'Homebar Free' } },
    ]) {
      for (const result of [await pushWorkspace(workspace.id, { ...valid, scheduledEnd: value }), await pushDefault({ ...valid, scheduledEnd: value })]) {
        expect(result.status, JSON.stringify(value)).toBe(400);
        expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
      }
    }
    expect(await prisma.workspaceEntitlement.count()).toBe(0);
    expect(await prisma.instanceSetting.findUnique({ where: { key: 'entitlements.default' } })).toBeNull();
  });
});

describe('PUT /api/v1/instance/entitlements/default', () => {
  it('applies only higher versions, keeps actor and reason and honours Idempotency-Key', async () => {
    const v1 = snapshotWire({ version: 1 });
    const headers = writeHeaders();
    expect(applyResult(await pushDefault(v1, headers))).toEqual({ applied: true, currentVersion: 1, currentHash: v1.hash });
    expect(applyResult(await pushDefault(v1, headers))).toEqual({ applied: true, currentVersion: 1, currentHash: v1.hash });
    expect(applyResult(await pushDefault(snapshotWire({ version: 1, planKey: 'x' })))).toEqual({ applied: false, currentVersion: 1, currentHash: v1.hash });
    const v5 = snapshotWire({ version: 5, planKey: 'homebar_free_2' });
    expect(applyResult(await pushDefault(v5, writeHeaders({ 'x-cm-reason': 'new free plan' })))).toEqual({
      applied: true,
      currentVersion: 5,
      currentHash: v5.hash,
    });
    const reused = await pushDefault(snapshotWire({ version: 6 }), headers);
    expect(reused.status).toBe(409);
    expect(errorCodeOf(reused)).toBe('IDEMPOTENCY_KEY_REUSED');

    const stored = await prisma.instanceSetting.findUniqueOrThrow({ where: { key: 'entitlements.default' } });
    expect(stored.value).toEqual({ snapshot: v5 });
    const audit = await prisma.instanceAuditLog.findFirstOrThrow({ where: { action: 'entitlements.default', reason: 'new free plan' } });
    expect(audit).toMatchObject({ targetType: 'instance', actor: 'admin@control-plane.test', response: { applied: true, currentVersion: 5 } });
    expect((await pushDefault({ ...v5, version: 7, limits: {} })).status).toBe(400);
  });
});

describe('instance inventory and capabilities', () => {
  it('fills the entitlement reference of list and detail', async () => {
    const { workspace } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const without = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const snapshot = snapshotWire({ version: 3, planKey: 'bar_pro' });
    await pushWorkspace(workspace.id, snapshot);

    const list = (await callAs('master', workspacesCollectionHandler, { method: 'GET' })).json as { data: InstanceWorkspaceSummaryDto[] };
    const byId = new Map(list.data.map((item) => [item.id, item]));
    expect(byId.get(workspace.id)!.entitlement).toEqual({ version: 3, hash: snapshot.hash, planKey: 'bar_pro' });
    expect(byId.get(without.workspace.id)!.entitlement).toBeNull();

    const detail = InstanceWorkspaceDetailSchema.strict().parse(
      dataOf(await callAs('master', workspacesItemHandler, { method: 'GET', query: { id: workspace.id } })),
    );
    expect(detail.entitlement).toEqual({ version: 3, hash: snapshot.hash, planKey: 'bar_pro' });
  });

  it('advertises entitlements only with ENTITLEMENTS_MODE=managed', async () => {
    const off = InstanceInfoSchema.parse(dataOf(await callAs('master', instanceHandler, { method: 'GET' })));
    expect(off.capabilities).not.toContain('entitlements');
    managed();
    const on = InstanceInfoSchema.parse(dataOf(await callAs('master', instanceHandler, { method: 'GET' })));
    expect(on).toMatchObject({ entitlementsMode: 'managed' });
    expect(on.capabilities).toContain('entitlements');
  });
});

describe('GET /api/v1/workspaces/{workspaceId}/entitlement', () => {
  const get = async (caller: Caller, workspaceId: string) =>
    WorkspaceEntitlementDtoSchema.strict().parse(dataOf(await callAsOk(caller, entitlementHandler, { method: 'GET', query: { workspaceId } })));

  it('reports mode off without plan and usage on self-hosted instances', async () => {
    const { a } = await seedTenantPair();
    await pushDefault(snapshotWire());
    expect(await get(roleUser(a, 'USER'), a.workspace.id)).toEqual({ mode: 'off', plan: null, usage: null, portalHandoff: false });
  });

  it('reports usage, then the default plan, then the own plan in managed mode', async () => {
    managed();
    const { a } = await seedTenantPair();
    const user = roleUser(a, 'USER');
    const glass = await seedGlass(a.workspace.id);
    await seedCocktail(a.workspace.id, glass.id);

    const before = await get(user, a.workspace.id);
    expect(before).toMatchObject({ mode: 'managed', plan: null, usage: { cocktails: 1, members: 4 } });

    await pushDefault(snapshotWire({ planName: { de: 'Gratis', en: 'Free' } }));
    expect((await get(user, a.workspace.id)).plan).toMatchObject({ planKey: 'homebar_free', source: 'default', planName: { de: 'Gratis', en: 'Free' } });

    await plan(a.workspace.id, { cocktails: 10 }, { billing: 'contact' });
    expect((await get(user, a.workspace.id)).plan).toMatchObject({ planKey: 'test_plan', source: 'workspace', billing: 'contact', limits: { cocktails: 10 } });
  });

  it('reads an unreadable stored snapshot leniently instead of falling back to the free default; a re-push of the same version applies', async () => {
    managed();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    await pushDefault(snapshotWire({ limits: { ...UNLIMITED, cocktails: 0 } }));
    const paid = snapshotWire({
      planKey: 'bar_pro',
      planName: { de: 'Bar Pro', en: 'Bar Pro' },
      limits: { ...UNLIMITED, members: 20 },
      features: ['signage'],
      version: 4,
    });
    applyResult(await pushWorkspace(a.workspace.id, paid));
    // A newer app validates stricter, or the row was edited: status and one limit no longer parse.
    const broken = { ...paid, status: 'PAUSED', limits: { ...paid.limits, cocktails: -1 } };
    await prisma.workspaceEntitlement.update({ where: { workspaceId: a.workspace.id }, data: { snapshot: broken as unknown as Prisma.InputJsonValue } });

    expect((await get(owner, a.workspace.id)).plan).toMatchObject({
      planKey: 'bar_pro',
      source: 'workspace',
      status: 'ACTIVE',
      limits: { cocktails: null, members: 20 },
      features: ['signage'],
    });
    // The free default (no cocktails) does not apply.
    expect((await callAs(owner, cocktailsHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { name: 'Still allowed' } })).status).toBe(
      200,
    );
    // Logged without values.
    const logged = errors.mock.calls.map((call) => String(call[0])).filter((message) => message.includes('[entitlements]'));
    expect(logged.join('\n')).not.toContain('PAUSED');

    // The control plane re-pushes the same version: applied, because the stored one is unreadable.
    expect(applyResult(await pushWorkspace(a.workspace.id, paid))).toEqual({ applied: true, currentVersion: 4, currentHash: paid.hash });
    expect(applyResult(await pushWorkspace(a.workspace.id, paid))).toEqual({ applied: false, currentVersion: 4, currentHash: paid.hash });
    expect((await prisma.workspaceEntitlement.findUnique({ where: { workspaceId: a.workspace.id } }))!.snapshot).toMatchObject({ status: 'ACTIVE' });
    errors.mockRestore();
  });

  it('re-applies a default push of the same version when the stored default is unreadable', async () => {
    managed();
    const free = snapshotWire({ version: 2 });
    applyResult(await pushDefault(free));
    await prisma.instanceSetting.update({
      where: { key: 'entitlements.default' },
      data: { value: { snapshot: { ...free, billing: 'invoice' } } as unknown as Prisma.InputJsonValue },
    });
    expect(applyResult(await pushDefault(free))).toEqual({ applied: true, currentVersion: 2, currentHash: free.hash });
    expect(applyResult(await pushDefault(free))).toMatchObject({ applied: false });
  });
});

/** `callAs` that resolves to the result (helper for the schema parse above). */
async function callAsOk(caller: Caller, handler: Parameters<typeof callAs>[1], options: Parameters<typeof callAs>[2]): Promise<HandlerResult> {
  const result = await callAs(caller, handler, options);
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return result;
}

// ---------------------------------------------------------------------------
// Guards (managed)
// ---------------------------------------------------------------------------

describe('guards with ENTITLEMENTS_MODE=managed', () => {
  beforeEach(() => {
    managed();
  });

  it('allows everything before the first push', async () => {
    const { a } = await seedTenantPair();
    const owner = roleUser(a, 'OWNER');
    const created = await callAs(owner, cocktailsHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { name: 'Free' } });
    expect(created.status).toBe(200);
    expect((await callAs(owner, overviewHandler, { method: 'GET', query: { workspaceId: a.workspace.id } })).status).toBe(200);
  });

  it('cocktails: create and clone up to the limit, archived ones do not count, unarchive is limited', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const manager = roleUser(a, 'MANAGER');
    const glass = await seedGlass(workspaceId);
    const first = await seedCocktail(workspaceId, glass.id);
    const archived = await seedCocktail(workspaceId, glass.id);
    await prisma.cocktailRecipe.update({ where: { id: archived.id }, data: { isArchived: true } });
    await plan(workspaceId, { cocktails: 2 });

    const create = (name: string) => callAs(manager, cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name } });
    expect((await create('Second')).status).toBe(200);
    expectPlanError(await create('Third'), 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 2, current: 2 });
    expectPlanError(
      await callAs(manager, cloneHandler, { method: 'POST', query: { workspaceId, cocktailId: first.id }, body: { name: 'Clone' } }),
      'PLAN_LIMIT_REACHED',
    );
    expectPlanError(await callAs(manager, unarchiveHandler, { method: 'PUT', query: { workspaceId, cocktailId: archived.id } }), 'PLAN_LIMIT_REACHED');
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId, isArchived: false } })).toBe(2);

    // Archiving frees a slot: clone and unarchive work again up to the limit.
    expect((await callAs(manager, archiveHandler, { method: 'PUT', query: { workspaceId, cocktailId: first.id } })).status).toBe(200);
    expect((await callAs(manager, unarchiveHandler, { method: 'PUT', query: { workspaceId, cocktailId: archived.id } })).status).toBe(200);
    expectPlanError(await callAs(manager, unarchiveHandler, { method: 'PUT', query: { workspaceId, cocktailId: first.id } }), 'PLAN_LIMIT_REACHED');
  });

  it('cocktails: parallel creates never overshoot the limit', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    await plan(workspaceId, { cocktails: 3 });
    const manager = roleUser(a, 'MANAGER');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => callAs(manager, cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: `C${index}` } })),
    );
    expect(results.filter((result) => result.status === 200)).toHaveLength(3);
    expect(results.filter((result) => result.status === 402)).toHaveLength(5);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId } })).toBe(3);
  });

  it('cocktails: the JSON import is refused when the result would exceed the limit, nothing is imported', async () => {
    const { a, b } = await seedTenantPair();
    const glassB = await seedGlass(b.workspace.id);
    const cocktails = [await seedCocktail(b.workspace.id, glassB.id), await seedCocktail(b.workspace.id, glassB.id)];
    const exported = await callAs(roleUser(b, 'USER'), cocktailsExportHandler, {
      method: 'POST',
      query: { workspaceId: b.workspace.id },
      body: { cocktailIds: cocktails.map((cocktail) => cocktail.id) },
    });
    const dump = exported.json as { cocktailRecipes: Array<{ id: string }> };
    const manager = roleUser(a, 'MANAGER');
    const mapping = await callAs(manager, cocktailsImportHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { phase: 'prepare-mapping', exportData: dump },
    });
    const { autoMappings } = mapping.json as { autoMappings: Record<string, unknown> };
    const decisions = { ...autoMappings, cocktails: dump.cocktailRecipes.map((cocktail) => ({ exportId: cocktail.id, decision: 'import' })) };
    const execute = () =>
      callAs(manager, cocktailsImportHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { phase: 'execute', exportData: dump, mappingDecisions: decisions },
      });

    await plan(a.workspace.id, { cocktails: 1 });
    expectPlanError(await execute(), 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 1, current: 0 });
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

    await plan(a.workspace.id, { cocktails: 2 });
    expect((await execute()).status).toBe(200);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(2);
  });

  it('backup import: refused above the limits (cocktails, calculations), applied at the limit', async () => {
    const { a, b } = await seedTenantPair();
    const content = await seedContent(b.workspace.id);
    await seedCocktail(b.workspace.id, content.glass.id);
    await prisma.cocktailCalculation.create({ data: { name: 'Party', workspaceId: b.workspace.id, updatedByUserId: roleUser(b, 'OWNER').user.id } });
    const backup = (await callAs(roleUser(b, 'ADMIN'), backupExportHandler, { method: 'GET', query: { workspaceId: b.workspace.id } })).json;
    const importInto = () =>
      callAs(roleUser(a, 'ADMIN'), backupImportHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: JSON.stringify(backup) });

    await plan(a.workspace.id, { cocktails: 1 });
    expectPlanError(await importInto(), 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 1, current: 0 });
    await plan(a.workspace.id, { cocktails: 2, calculations: 0 });
    expectPlanError(await importInto(), 'PLAN_LIMIT_REACHED', { key: 'calculations', limit: 0, current: 0 });
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

    await plan(a.workspace.id, { cocktails: 2, calculations: 1 });
    const imported = await importInto();
    expect(imported.status, JSON.stringify(imported.json)).toBe(200);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(2);
  });

  it('template apply: refused when the template exceeds the limit, applied at the limit', async () => {
    const template = await createWorkspace({ name: 'Mini', locale: 'de', setupCompleted: true });
    const glass = await seedGlass(template.id);
    await seedCocktail(template.id, glass.id);
    await seedCocktail(template.id, glass.id);
    await prisma.workspaceTemplate.create({
      data: { workspaceId: template.id, key: 'mini', kind: 'CATALOG', name: { de: 'Mini', en: 'Mini' }, locales: ['de'], published: true },
    });
    const { a } = await seedTenantPair();
    const apply = () =>
      callAs(roleUser(a, 'MANAGER'), applyHandler, { method: 'POST', query: { workspaceId: a.workspace.id, key: 'mini' }, body: { mode: 'all' } });

    await plan(a.workspace.id, { cocktails: 1 });
    expectPlanError(await apply(), 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 1, current: 0 });
    expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    await plan(a.workspace.id, { cocktails: 2 });
    const applied = await apply();
    expect(applied.status, JSON.stringify(applied.json)).toBe(200);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(2);
  });

  it('members: accepting a join request and joining an empty workspace', async () => {
    const { a } = await seedTenantPair(); // 4 members
    const applicants = [await seedWorkspace({ users: [{ role: 'OWNER' }] }), await seedWorkspace({ users: [{ role: 'OWNER' }] })].map(
      (seeded) => seeded.users[0]!,
    );
    for (const applicant of applicants) await prisma.workspaceJoinRequest.create({ data: { userId: applicant.user.id, workspaceId: a.workspace.id } });
    await plan(a.workspace.id, { members: 5 });
    const accept = (userId: string) => callAs(roleUser(a, 'MANAGER'), acceptHandler, { method: 'POST', query: { workspaceId: a.workspace.id, userId } });

    expect((await accept(applicants[0]!.user.id)).status).toBe(200);
    expectPlanError(await accept(applicants[1]!.user.id), 'PLAN_LIMIT_REACHED', { key: 'members', limit: 5, current: 5 });
    expect(await prisma.workspaceUser.count({ where: { workspaceId: a.workspace.id } })).toBe(5);

    const empty = await prisma.workspace.create({ data: { name: 'Empty' } });
    await prisma.workspaceJoinCode.create({ data: { workspaceId: empty.id, code: 'EMPTY123', onlyUseOnce: false } });
    await plan(empty.id, { members: 0 });
    expectPlanError(await callAs(applicants[1]!, joinHandler, { method: 'POST', query: { code: 'EMPTY123' } }), 'PLAN_LIMIT_REACHED');
    await plan(empty.id, { members: 1 });
    expect((await callAs(applicants[1]!, joinHandler, { method: 'POST', query: { code: 'EMPTY123' } })).status).toBe(200);
  });

  it('calculations: create and import up to the limit', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const user = roleUser(a, 'USER');
    const content = await seedContent(workspaceId);
    await plan(workspaceId, { calculations: 1 });
    const create = (name: string) =>
      callAs(user, calculationsHandler, { method: 'POST', query: { workspaceId }, body: { name, calculationItems: [], ingredientShoppingUnits: [] } });
    expect((await create('First')).status).toBe(200);
    expectPlanError(await create('Second'), 'PLAN_LIMIT_REACHED', { key: 'calculations', limit: 1, current: 1 });

    const refs = { cocktailName: content.cocktail.name, ingredientName: content.ingredient.name, unitName: content.unit.name };
    const importBody = {
      phase: 'execute',
      decisions: [{ exportName: 'Imported', decision: 'import', data: calculationExportItem('Imported', refs) }],
      cocktailMappings: [{ exportName: content.cocktail.name, decision: 'use-existing', existingId: content.cocktail.id }],
      ingredientMappings: [{ exportName: content.ingredient.name, decision: 'use-existing', existingId: content.ingredient.id }],
      unitMappings: [{ exportName: content.unit.name, decision: 'use-existing', existingId: content.unit.id }],
    };
    expectPlanError(await callAs(user, calculationsImportHandler, { method: 'POST', query: { workspaceId }, body: importBody }), 'PLAN_LIMIT_REACHED');
    await plan(workspaceId, { calculations: 2 });
    const imported = await callAs(user, calculationsImportHandler, { method: 'POST', query: { workspaceId }, body: importBody });
    expect(imported.status, JSON.stringify(imported.json)).toBe(200);
    expect(await prisma.cocktailCalculation.count({ where: { workspaceId } })).toBe(2);
  });

  it('guestMenusPublished: publishing up to the limit, republishing stays possible', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const manager = roleUser(a, 'MANAGER');
    const menus = [];
    for (const name of ['Abend', 'Mittag']) {
      const created = await callAs(manager, guestMenusHandler, { method: 'POST', query: { workspaceId }, body: { name } });
      menus.push(dataOf<{ id: string }>(created));
    }
    await plan(workspaceId, { guestMenusPublished: 1 });
    const publish = (menuId: string) => callAs(manager, publishHandler, { method: 'POST', query: { workspaceId, menuId } });
    expect((await publish(menus[0]!.id)).status).toBe(200);
    expectPlanError(await publish(menus[1]!.id), 'PLAN_LIMIT_REACHED', { key: 'guestMenusPublished', limit: 1, current: 1 });
    expect((await publish(menus[0]!.id)).status).toBe(200);
  });

  it('signage: writes need the feature, screens are limited, the public feed requires the plan', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const manager = roleUser(a, 'MANAGER');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const upload = (format: string) => callAs(manager, slidesHandler, { method: 'POST', query: { workspaceId }, body: { format, slides: [png] } });
    const feed = () => callAs('anonymous', publicSignageHandler, { method: 'GET', query: { id: workspaceId, format: 'LANDSCAPE' } });

    await plan(workspaceId, { signageScreens: 1 });
    expectPlanError(await upload('LANDSCAPE'), 'PLAN_FEATURE_MISSING', { key: 'signage', limit: null, current: null });
    expectPlanError(await callAs(manager, signageHandler, { method: 'PUT', query: { workspaceId }, body: {} }), 'PLAN_FEATURE_MISSING');
    expect((await callAs(manager, signageHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expectPlanError(await feed(), 'PLAN_FEATURE_MISSING');

    await plan(workspaceId, { signageScreens: 1 }, { features: ['signage'] });
    expect((await upload('LANDSCAPE')).status).toBe(201);
    expect((await upload('LANDSCAPE')).status).toBe(201);
    expectPlanError(await upload('PORTRAIT'), 'PLAN_LIMIT_REACHED', { key: 'signageScreens', limit: 1, current: 1 });
    expect(await prisma.signage.count({ where: { workspaceId } })).toBe(1);
    expect((await feed()).status).toBe(200);
  });

  it('api: creating keys needs the feature and is limited; existing keys fail while the feature is missing', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const owner = roleUser(a, 'OWNER');
    const existing = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ']);
    const create = () => callAs(owner, apiKeysHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Key', permissions: ['COCKTAILS_READ'] } });
    const useKey = () => callAs({ apiKeyJwt: existing.jwt }, cocktailsHandler, { method: 'GET', query: { workspaceId } });

    await plan(workspaceId, { apiKeys: 2 });
    expectPlanError(await create(), 'PLAN_FEATURE_MISSING', { key: 'api', limit: null, current: null });
    expectPlanError(await useKey(), 'PLAN_FEATURE_MISSING', { key: 'api', limit: null, current: null });
    expect(await prisma.workspaceApiKey.count({ where: { workspaceId, revoked: false } })).toBe(1);

    await plan(workspaceId, { apiKeys: 2 }, { features: ['api'] });
    expect((await useKey()).status).toBe(200);
    expect((await create()).status).toBe(200);
    expectPlanError(await create(), 'PLAN_LIMIT_REACHED', { key: 'apiKeys', limit: 2, current: 2 });
  });

  it('statistics.advanced: refused without the feature', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    await plan(workspaceId, {});
    expectPlanError(await callAs(roleUser(a, 'USER'), overviewHandler, { method: 'GET', query: { workspaceId } }), 'PLAN_FEATURE_MISSING', {
      key: 'statistics.advanced',
      limit: null,
      current: null,
    });
    await plan(workspaceId, {}, { features: ['statistics.advanced'] });
    expect((await callAs(roleUser(a, 'USER'), overviewHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
  });

  it('branding.remove: guest menu prints carry "Powered by" without the feature', async () => {
    const { a } = await seedTenantPair();
    const created = await callAs(roleUser(a, 'MANAGER'), guestMenusHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { name: 'Karte' },
    });
    const menu = await prisma.guestMenu.findUniqueOrThrow({ where: { id: dataOf<{ id: string }>(created).id } });
    const tent = async () => (await buildTableTentHtml(a.workspace, menu, { target: 'bar' })).html;

    await plan(a.workspace.id, {});
    expect(await tent()).toContain('Powered by Cocktail-Manager');
    await plan(a.workspace.id, {}, { features: ['branding.remove'] });
    expect(await tent()).not.toContain('Powered by');
  });
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

describe('workspace status with ENTITLEMENTS_MODE=managed', () => {
  beforeEach(() => {
    managed();
  });

  async function setup(status: SnapshotWire['status']) {
    const { a } = await seedTenantPair();
    const glass = await seedGlass(a.workspace.id);
    const cocktail = await seedCocktail(a.workspace.id, glass.id);
    await plan(a.workspace.id, {}, { status, features: ['api'] });
    return { a, workspaceId: a.workspace.id, cocktail };
  }

  it('GRACE changes nothing', async () => {
    const { a, workspaceId } = await setup('GRACE');
    expect((await callAs(roleUser(a, 'MANAGER'), cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'New' } })).status).toBe(200);
  });

  it('READ_ONLY refuses every write except export, leaving and deleting', async () => {
    const { a, workspaceId, cocktail } = await setup('READ_ONLY');
    const owner = roleUser(a, 'OWNER');
    const key = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ', 'COCKTAILS_CREATE']);

    expect((await callAs(roleUser(a, 'USER'), cocktailsHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expectPlanError(
      await callAs(roleUser(a, 'MANAGER'), cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'New' } }),
      'WORKSPACE_READ_ONLY',
    );
    expectPlanError(
      await callAs(roleUser(a, 'MANAGER'), archiveHandler, { method: 'PUT', query: { workspaceId, cocktailId: cocktail.id } }),
      'WORKSPACE_READ_ONLY',
    );
    expectPlanError(
      await callAs({ apiKeyJwt: key.jwt }, cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Via key' } }),
      'WORKSPACE_READ_ONLY',
    );

    expect(
      (await callAs(roleUser(a, 'USER'), cocktailsExportHandler, { method: 'POST', query: { workspaceId }, body: { cocktailIds: [cocktail.id] } })).status,
    ).toBe(200);
    expect((await callAs(roleUser(a, 'ADMIN'), backupExportHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    // The control plane (master key) is not limited by the status.
    expect((await callAs('master', cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Support fix' } })).status).toBe(200);
    expect((await callAs(roleUser(a, 'USER'), leaveHandler, { method: 'POST', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(owner, workspaceItemHandler, { method: 'DELETE', query: { workspaceId } })).status).toBe(200);
    expect(await prisma.workspace.findUnique({ where: { id: workspaceId } })).toBeNull();
  });

  it('SUSPENDED blocks reads too, except the status view, export, leaving and deleting', async () => {
    const { a, workspaceId } = await setup('SUSPENDED');
    const user = roleUser(a, 'USER');
    expectPlanError(await callAs(user, cocktailsHandler, { method: 'GET', query: { workspaceId } }), 'WORKSPACE_SUSPENDED');
    expectPlanError(
      await callAs(roleUser(a, 'MANAGER'), cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'X' } }),
      'WORKSPACE_SUSPENDED',
    );

    expect((await callAs(user, workspaceItemHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    const status = dataOf<WorkspaceEntitlementDto>(await callAs(user, entitlementHandler, { method: 'GET', query: { workspaceId } }));
    expect(status.plan?.status).toBe('SUSPENDED');
    // The other reads of the app shell on every workspace load stay open; writes do not.
    expect((await callAs(user, translationsCollectionHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(user, workspaceAnnouncementsHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expectPlanError(
      await callAs(roleUser(a, 'ADMIN'), translationsCollectionHandler, {
        method: 'PUT',
        query: { workspaceId },
        body: { key: 'SHAKE', translations: { de: 'Schütteln' } },
      }),
      'WORKSPACE_SUSPENDED',
    );

    // Every member exports all cocktails and calculations without listing them first (the lists are blocked).
    const content = await seedContent(workspaceId);
    await seedCalculation(workspaceId, user.user.id, { cocktailId: content.cocktail.id, ingredientId: content.ingredient.id, unitId: content.unit.id });
    const cocktailsDump = await callAs(user, cocktailsExportHandler, { method: 'POST', query: { workspaceId }, body: { all: true } });
    expect(cocktailsDump.status, JSON.stringify(cocktailsDump.json)).toBe(200);
    const allIds = (await prisma.cocktailRecipe.findMany({ where: { workspaceId }, select: { id: true } })).map((row) => row.id);
    expect(allIds).toHaveLength(2);
    expect((cocktailsDump.json as { cocktailRecipes: Array<{ id: string }> }).cocktailRecipes.map((item) => item.id).sort()).toEqual(allIds.sort());
    const calculationsDump = await callAs(user, calculationsExportHandler, { method: 'POST', query: { workspaceId }, body: { all: true } });
    expect(calculationsDump.status, JSON.stringify(calculationsDump.json)).toBe(200);
    expect(calculationsDump.json).toMatchObject({ calculation: { workspaceId } });
    // Either ids or `all`, not both and not neither.
    for (const body of [{}, { all: true, cocktailIds: [content.cocktail.id] }, { all: false }]) {
      expect((await callAs(user, cocktailsExportHandler, { method: 'POST', query: { workspaceId }, body })).status, JSON.stringify(body)).toBe(400);
    }
    for (const body of [{}, { all: true, ids: [] }]) {
      expect((await callAs(user, calculationsExportHandler, { method: 'POST', query: { workspaceId }, body })).status, JSON.stringify(body)).toBe(400);
    }
    expect((await callAs(roleUser(a, 'ADMIN'), backupExportHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(user, leaveHandler, { method: 'POST', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(roleUser(a, 'OWNER'), workspaceItemHandler, { method: 'DELETE', query: { workspaceId } })).status).toBe(200);
  });
});

describe('public pages with ENTITLEMENTS_MODE=managed', () => {
  beforeEach(() => {
    managed();
  });

  it('SUSPENDED shows "currently not available" on menus, their images and the signage feed; READ_ONLY keeps them', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    await prisma.workspace.update({ where: { id: workspaceId }, data: { publicSlug: 'suspended-bar', image: PIXEL_PNG } });
    const document = createDefaultGuestMenuDocument() as unknown as Prisma.InputJsonValue;
    await prisma.guestMenu.create({
      data: { workspaceId, name: 'Karte', slug: 'karte', enabled: true, isDefault: true, draft: document, published: document, publishedAt: new Date() },
    });
    const menu = () => loadPublicMenu({ bar: 'suspended-bar', menuSlug: null, locale: null });
    const menuApi = () => callAs('anonymous', publicMenusHandler, { method: 'GET', query: { slug: ['suspended-bar'] } });
    const feed = () => callAs('anonymous', publicSignageHandler, { method: 'GET', query: { id: workspaceId } });
    // The menu shows the workspace logo (no own logo in the theme).
    const logo = () =>
      callAs('anonymous', publicImagesHandler, { method: 'GET', query: { workspaceSlug: 'suspended-bar', kind: 'workspace-logo', id: workspaceId } });

    await plan(workspaceId, {}, { status: 'READ_ONLY', features: ['signage'] });
    expect((await menu()).kind).toBe('menu');
    expect((await feed()).status).toBe(200);
    expect((await logo()).status).toBe(200);

    await plan(workspaceId, {}, { status: 'SUSPENDED', features: ['signage'] });
    expect((await menu()).kind).toBe('unavailable');
    const api = await menuApi();
    expect(api.status).toBe(503);
    expect(api.json).toMatchObject({ status: 'unavailable' });
    const blocked = await feed();
    expect(blocked.status).toBe(503);
    expect(errorCodeOf(blocked)).toBe('WORKSPACE_UNAVAILABLE');
    const image = await logo();
    expect(image.status).toBe(503);
    expect(errorCodeOf(image)).toBe('WORKSPACE_UNAVAILABLE');
    expect(image.headers['Cache-Control']).toBe('private, no-store');
  });
});

// ---------------------------------------------------------------------------
// freeWorkspacesPerOwner
// ---------------------------------------------------------------------------

describe('freeWorkspacesPerOwner', () => {
  const createAs = (seeded: SeededWorkspace, name: string) => callAs(seeded.users[0]!, workspacesHandler, { method: 'POST', body: { name } });

  beforeEach(() => {
    managed();
    vi.stubEnv('ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER', '2');
  });

  it('limits the free workspaces a user owns; paid workspaces and the admin route are exempt', async () => {
    const owner = await seedWorkspace({ users: [{ role: 'OWNER' }] }); // owns 1 workspace
    expect((await createAs(owner, 'Before default')).status).toBe(200); // nothing pushed yet: no limit
    await prisma.workspace.delete({ where: { id: (await prisma.workspace.findFirstOrThrow({ where: { name: 'Before default' } })).id } });

    await pushDefault(snapshotWire());
    expect((await createAs(owner, 'Second')).status).toBe(200);
    expectPlanError(await createAs(owner, 'Third'), 'PLAN_LIMIT_REACHED', { key: 'freeWorkspacesPerOwner', limit: 2, current: 2 });

    // A paid workspace does not count.
    await plan(owner.workspace.id, {}, { planKey: 'bar_pro' });
    expect((await createAs(owner, 'Third')).status).toBe(200);
    expectPlanError(await createAs(owner, 'Fourth'), 'PLAN_LIMIT_REACHED');

    // The control plane creates workspaces without the check.
    expect((await callAs('master', adminWorkspaceHandler, { method: 'POST', body: { name: 'By control plane' } })).status).toBeLessThan(300);
  });

  it('does not apply with ENTITLEMENTS_MODE=off', async () => {
    vi.stubEnv('ENTITLEMENTS_MODE', 'off');
    const owner = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await pushDefault(snapshotWire());
    for (const name of ['A', 'B', 'C']) expect((await createAs(owner, name)).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// ENTITLEMENTS_MODE=off
// ---------------------------------------------------------------------------

describe('ENTITLEMENTS_MODE=off', () => {
  it('ignores pushed snapshots: no limits, no features, no status', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const owner = roleUser(a, 'OWNER');
    const key = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ', 'COCKTAILS_CREATE']);
    const zero = { cocktails: 0, members: 0, calculations: 0, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 };
    await pushDefault(snapshotWire({ limits: zero, status: 'SUSPENDED' }));
    await pushWorkspace(workspaceId, snapshotWire({ limits: zero, status: 'SUSPENDED' }));

    expect((await callAs(roleUser(a, 'MANAGER'), cocktailsHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Still works' } })).status).toBe(
      200,
    );
    expect((await callAs({ apiKeyJwt: key.jwt }, cocktailsHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(roleUser(a, 'USER'), overviewHandler, { method: 'GET', query: { workspaceId } })).status).toBe(200);
    expect((await callAs(owner, apiKeysHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Key', permissions: [] } })).status).toBe(200);
    expect((await callAs('anonymous', publicSignageHandler, { method: 'GET', query: { id: workspaceId } })).status).toBe(200);
    const menu = await prisma.guestMenu.create({
      data: { workspaceId, name: 'Karte', slug: 'karte', draft: {} as Prisma.InputJsonValue },
    });
    const tent = (await buildTableTentHtml(a.workspace, menu, { target: 'bar' })).html;
    expect(tent).not.toContain('Powered by');
    // Byte for byte the document of v1.22: no branding CSS, no extra line.
    expect(tent).not.toContain('gm-powered-by');
    expect(tent).toContain('</p></div>\n</div>');
  });

  it('answers byte for byte as without the control plane: restrictive snapshots and announcements change no body, and no query reads them', async () => {
    const { a } = await seedTenantPair();
    const workspaceId = a.workspace.id;
    const owner = roleUser(a, 'OWNER');
    const user = roleUser(a, 'USER');
    const key = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ', 'COCKTAILS_CREATE', 'COCKTAILS_DELETE']);
    const content = await seedContent(workspaceId);
    await seedCalculation(workspaceId, owner.user.id, { cocktailId: content.cocktail.id, ingredientId: content.ingredient.id, unitId: content.unit.id });
    await prisma.workspace.update({ where: { id: workspaceId }, data: { publicSlug: 'off-bar', image: PIXEL_PNG } });
    const document = createDefaultGuestMenuDocument() as unknown as Prisma.InputJsonValue;
    const menu = await prisma.guestMenu.create({
      data: { workspaceId, name: 'Karte', slug: 'karte', enabled: true, isDefault: true, draft: document, published: document, publishedAt: new Date() },
    });
    const q = { workspaceId };

    /** Representative existing routes: reads by role and API key, writes, exports and every public output. */
    async function responses() {
      const results: Record<string, { status: number; body: unknown }> = {};
      const record = async (name: string, result: Promise<HandlerResult>) => {
        const { status, json, body } = await result;
        results[name] = { status, body: json ?? (Buffer.isBuffer(body) ? body.toString('base64') : body) };
      };
      await record('GET workspace (user)', callAs(user, workspaceItemHandler, { method: 'GET', query: q }));
      await record('GET translations (user)', callAs(user, translationsCollectionHandler, { method: 'GET', query: q }));
      await record('GET cocktails (user)', callAs(user, cocktailsHandler, { method: 'GET', query: q }));
      await record('GET cocktails (api key)', callAs({ apiKeyJwt: key.jwt }, cocktailsHandler, { method: 'GET', query: q }));
      await record('GET calculations (owner)', callAs(owner, calculationsHandler, { method: 'GET', query: q }));
      await record('GET statistics/advanced (user)', callAs(user, overviewHandler, { method: 'GET', query: q }));
      await record('GET guest menu (owner)', callAs(owner, guestMenuItemHandler, { method: 'GET', query: { ...q, menuId: menu.id } }));
      await record('GET entitlement (user)', callAs(user, entitlementHandler, { method: 'GET', query: q }));
      await record('GET announcements (user)', callAs(user, announcementsHandler, { method: 'GET' }));
      await record('GET workspace announcements (user)', callAs(user, workspaceAnnouncementsHandler, { method: 'GET', query: q }));
      await record(
        'POST cocktails/export/json (user)',
        callAs(user, cocktailsExportHandler, { method: 'POST', query: q, body: { cocktailIds: [content.cocktail.id] } }),
      );
      await record('GET guest menu export/html (user)', callAs(user, guestMenuHtmlHandler, { method: 'GET', query: { ...q, menuId: menu.id } }));
      await record('GET backup export (admin)', callAs(roleUser(a, 'ADMIN'), backupExportHandler, { method: 'GET', query: q }));
      await record('GET public menu', callAs('anonymous', publicMenusHandler, { method: 'GET', query: { slug: ['off-bar'] } }));
      await record(
        'GET public image',
        callAs('anonymous', publicImagesHandler, { method: 'GET', query: { workspaceSlug: 'off-bar', kind: 'workspace-logo', id: workspaceId } }),
      );
      await record('GET public signage feed', callAs('anonymous', publicSignageHandler, { method: 'GET', query: { id: workspaceId } }));
      results['table tent html'] = { status: 200, body: (await buildTableTentHtml(a.workspace, menu, { target: 'bar' })).html };
      // A write and its undo, so the reads of the next run see the same data.
      const created = await callAs({ apiKeyJwt: key.jwt }, cocktailsHandler, { method: 'POST', query: q, body: { name: 'Off write' } });
      results['POST cocktails (api key)'] = { status: created.status, body: created.json };
      const createdId = dataOf<{ id: string }>(created).id;
      await record(
        'DELETE cocktail (api key)',
        callAs({ apiKeyJwt: key.jwt }, cocktailItemHandler, { method: 'DELETE', query: { ...q, cocktailId: createdId } }),
      );
      return normalizeVolatile(JSON.parse(JSON.stringify(results).replaceAll(createdId, '<created cocktail>')) as typeof results);
    }

    const before = await responses();

    // Everything the control plane could have pushed, as restrictive as possible.
    const zero = { cocktails: 0, members: 0, calculations: 0, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 };
    applyResult(await pushDefault(snapshotWire({ limits: zero, status: 'SUSPENDED' })));
    applyResult(await pushWorkspace(workspaceId, snapshotWire({ limits: zero, status: 'SUSPENDED' })));
    const announcement = { level: 'critical', body: { de: 'Gesperrt', en: 'Suspended' } };
    const pushed = await callAs('master', instanceAnnouncementsHandler, {
      method: 'PUT',
      body: {
        announcements: [
          { id: 'all', ...announcement, workspaceIds: [] },
          { id: 'ws', ...announcement, workspaceIds: [workspaceId] },
        ],
      },
    });
    expect(pushed.status, JSON.stringify(pushed.json)).toBe(200);

    // Every statement the app sends while answering, at the driver (Prisma's adapter uses this `pg`).
    const sql: string[] = [];
    const originalQuery = pg.Client.prototype.query;
    const query = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (this: pg.Client, ...args: unknown[]) {
      const config = args[0] as string | { text?: string } | undefined;
      sql.push(typeof config === 'string' ? config : (config?.text ?? ''));
      return (originalQuery as (...values: unknown[]) => unknown).apply(this, args);
    } as never);
    let after: Awaited<ReturnType<typeof responses>>;
    try {
      after = await responses();
    } finally {
      query.mockRestore();
    }

    expect(after).toEqual(before);
    expect(sql.length).toBeGreaterThan(20);
    expect(sql.filter((text) => /"(WorkspaceEntitlement|InstanceSetting|InstanceAnnouncement|InstanceAuditLog)"/.test(text))).toEqual([]);
  });
});
