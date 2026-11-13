/**
 * Generic tenant-isolation suite over EVERY documented v1 operation.
 *
 * Tenant A's owner (session) and the master key (scoped to workspace A) call each
 * operation with ids that belong to tenant B — in the path, and for the
 * operations listed in FOREIGN_ID_OVERRIDES also in the body/query. Every call
 * must be rejected (400/404; GETs may alternatively answer without B's data),
 * must not leak B's data and must not change a single row in the database.
 *
 * New operations are covered automatically; a body sample that fails validation
 * fails the suite, so every operation is exercised past validation.
 */
import { describe, expect, it } from 'vitest';
import { flattenOperations, type FlatOperation } from '@lib/openapi/flattenOperations';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import { handlerBindings } from '@test/helpers/handlerBindings';
import { sampleFromSchema } from '@test/helpers/sampleFromSchema';
import { callAs, errorCodeOf, roleUser, seedTenantPair, type Caller } from '@test/helpers/scenario';
import { databaseFingerprint, seedTenantGraph, type TenantGraph } from '@test/helpers/fixtures/tenantGraph';
import type { HandlerResult } from '@test/helpers/invokeHandler';

const MARKER = 'TENANT-B-SECRET-7f3a';

type Ids = TenantGraph['ids'];
type Override = { body?: (ids: Ids) => Record<string, unknown>; query?: (ids: Ids) => Record<string, string> };

const key = (op: Pick<FlatOperation, 'method' | 'basePath'>) => `${op.method} ${op.basePath}`;
const WS = '/workspaces/{workspaceId}';

/** Body/query fields that reference tenant-B ids, merged over the generated sample body. */
const FOREIGN_ID_OVERRIDES: Record<string, Override> = {
  [`PUT ${WS}/guest-menus/{menuId}/draft`]: { body: () => createDefaultGuestMenuDocument() as unknown as Record<string, unknown> },
  [`PUT ${WS}/statistics/advanced/sets`]: { body: (ids) => ({ id: ids.setId, name: 'renamed' }) },
  [`DELETE ${WS}/statistics/advanced/sets`]: { query: (ids) => ({ id: ids.setId }) },
  [`POST ${WS}/queue/add`]: { body: (ids) => ({ cocktailId: ids.cocktailId }) },
  [`POST ${WS}/statistics/cocktails/add`]: { body: (ids) => ({ cocktailId: ids.cocktailId }) },
  [`POST ${WS}/glasses/export/json`]: { body: (ids) => ({ ids: [ids.glassId] }) },
  [`POST ${WS}/garnishes/export/json`]: { body: (ids) => ({ ids: [ids.garnishId] }) },
  [`POST ${WS}/ingredients/export/json`]: { body: (ids) => ({ ids: [ids.ingredientId] }) },
  [`POST ${WS}/calculations/export/json`]: { body: (ids) => ({ ids: [ids.calculationId] }) },
  [`POST ${WS}/cocktails/export/json`]: { body: (ids) => ({ cocktailIds: [ids.cocktailId], ids: [ids.cocktailId] }) },
  [`POST ${WS}/calculations/groups/assign`]: { body: (ids) => ({ calculationIds: [ids.calculationId], groupId: ids.groupId }) },
  [`PUT ${WS}/guest-menus/reorder`]: { body: (ids) => ({ ids: [ids.menuId], menuIds: [ids.menuId] }) },
};

/** Operations whose path params are not tenant-entity ids (or name the caller's own data). */
const PATH_PARAM_SOURCE: Record<string, (ids: Ids) => Record<string, string>> = {
  [`POST ${WS}/join-requests/{userId}/accept`]: (ids) => ({ userId: ids.applicantUserId }),
  [`POST ${WS}/join-requests/{userId}/reject`]: (ids) => ({ userId: ids.applicantUserId }),
};

function pathParams(op: FlatOperation, ids: Ids): Record<string, string> {
  const custom = PATH_PARAM_SOURCE[key(op)];
  if (custom) return custom(ids);
  const params: Record<string, string> = {};
  for (const match of op.basePath.matchAll(/\{(\w+)\}/g)) {
    const name = match[1]!;
    if (name === 'workspaceId') continue;
    const value = ids[name];
    if (!value) throw new Error(`No tenant-graph id for path param {${name}} (${key(op)}) — extend seedTenantGraph`);
    params[name] = value;
  }
  return params;
}

function bodyFor(op: FlatOperation, ids: Ids): unknown {
  const override = FOREIGN_ID_OVERRIDES[key(op)];
  if (!op.spec.body) return undefined;
  const sample = sampleFromSchema(op.spec.body);
  if (!override?.body) return sample;
  const extra = override.body(ids);
  return typeof sample === 'object' && sample !== null && !Array.isArray(sample) ? { ...sample, ...extra } : extra;
}

function responseText(result: HandlerResult): string {
  const parts: string[] = [];
  if (result.json !== undefined) parts.push(JSON.stringify(result.json));
  if (Buffer.isBuffer(result.body)) parts.push(result.body.toString('latin1'));
  else if (typeof result.body === 'string') parts.push(result.body);
  else if (result.body !== undefined && result.body !== result.json) parts.push(JSON.stringify(result.body));
  return parts.join('\n');
}

function involvesForeignId(op: FlatOperation): boolean {
  return (
    /\{(?!workspaceId\})\w+\}/.test(op.basePath) ||
    Boolean(FOREIGN_ID_OVERRIDES[key(op)]?.query) ||
    Boolean(FOREIGN_ID_OVERRIDES[key(op)]?.body && op.spec.body)
  );
}

describe('tenant isolation over all v1 operations (integration)', () => {
  it('rejects tenant-B ids for every operation without leaking or changing data', async () => {
    const { a, b } = await seedTenantPair();
    const graphB = await seedTenantGraph(b, MARKER);
    await seedTenantGraph(a, 'TENANT-A-OWN');

    const operations = (await flattenOperations()).filter((op) => op.basePath.startsWith(`${WS}/`) && involvesForeignId(op));
    expect(operations.length).toBeGreaterThan(40);

    const callers: Array<[string, Caller]> = [
      ['owner session', roleUser(a, 'OWNER')],
      ['master key', 'master'],
    ];
    const failures: string[] = [];

    for (const [callerName, caller] of callers) {
      for (const op of operations) {
        const label = `[${callerName}] ${key(op)}`;
        const binding = handlerBindings.find((entry) => entry.apiDoc.basePath === op.basePath);
        if (!binding) {
          failures.push(`${label}: no handler binding in test/helpers/handlerBindings.ts`);
          continue;
        }
        if (op.spec.sessionOnly && caller === 'master') continue;

        const override = FOREIGN_ID_OVERRIDES[key(op)];
        const query = { workspaceId: a.workspace.id, ...pathParams(op, graphB.ids), ...(override?.query?.(graphB.ids) ?? {}) };
        const before = await databaseFingerprint();
        const result = await callAs(caller, binding.handler, { method: op.method, query, body: bodyFor(op, graphB.ids) });
        const after = await databaseFingerprint();

        const leaked = responseText(result).includes(MARKER);
        const rejected = result.status === 404 || result.status === 400;
        const acceptable = rejected || (op.method === 'GET' && result.status < 300 && !leaked);

        if (errorCodeOf(result) === 'VALIDATION_ERROR')
          failures.push(`${label}: generated body/query is invalid — add an override (${JSON.stringify(result.json).slice(0, 300)})`);
        else if (!acceptable) failures.push(`${label}: expected 400/404, got ${result.status} ${JSON.stringify(result.json ?? '').slice(0, 200)}`);
        if (leaked) failures.push(`${label}: response contains tenant-B data`);
        if (before !== after) failures.push(`${label}: database changed (status ${result.status})`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  }, 600_000);

  it('has a handler binding for every documented operation', async () => {
    const missing = (await flattenOperations()).filter((op) => !handlerBindings.some((entry) => entry.apiDoc.basePath === op.basePath)).map((op) => key(op));
    expect(missing).toEqual([]);
  });
});
