/**
 * Happy-path calls for operations that the per-resource suites don't exercise
 * through their HTTP handler. Together with the other integration tests this
 * keeps the API coverage gate (test/globalSetup.ts) green: every documented
 * operation answers 2xx at least once.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import { BUILT_IN_TEMPLATES } from '@lib/guest-menu/templates';
import { handlerBindings } from '@test/helpers/handlerBindings';
import { sampleFromSchema } from '@test/helpers/sampleFromSchema';
import { callAs, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedTenantGraph } from '@test/helpers/fixtures/tenantGraph';
import prisma from '../../../../prisma/prisma';

const WS = '/workspaces/{workspaceId}';

const RANGE = { startDate: '2020-01-01', endDate: '2030-12-31' };

function templateBody(name: string) {
  const sample = sampleFromSchema(handlerBindings.find((entry) => entry.apiDoc.basePath === `${WS}/guest-menus/templates`)!.apiDoc.operations.POST!.body!) as {
    definition: Record<string, unknown>;
  };
  return { name, definition: { ...sample.definition, baseTemplateId: BUILT_IN_TEMPLATES[0]!.id } };
}

interface Case {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: (ids: Record<string, string>) => Record<string, string>;
  body?: (ids: Record<string, string>) => unknown;
}

/** Ordered: reads and updates first, deletes last. */
const CASES: Case[] = [
  { method: 'GET', path: `${WS}/api-keys/{keyId}` },
  { method: 'GET', path: `${WS}/calculations/{calculationId}` },
  { method: 'POST', path: `${WS}/calculations/export/json`, body: (ids) => ({ ids: [ids.calculationId] }) },
  { method: 'POST', path: `${WS}/calculations/groups`, body: () => ({ name: 'Coverage group' }) },
  { method: 'PUT', path: `${WS}/calculations/groups/{groupId}`, body: () => ({ name: 'Coverage group renamed' }) },
  { method: 'POST', path: `${WS}/calculations/groups/assign`, body: (ids) => ({ calculationIds: [ids.calculationId], groupId: ids.groupId }) },
  { method: 'GET', path: `${WS}/cards/{cardId}` },
  { method: 'GET', path: `${WS}/cocktails/{cocktailId}` },
  { method: 'GET', path: `${WS}/cocktails/{cocktailId}/guest-info` },
  { method: 'GET', path: `${WS}/cocktails/check`, query: () => ({ name: 'COVERAGE cocktail' }) },
  { method: 'GET', path: `${WS}/ingredients/check`, query: () => ({ name: 'COVERAGE ingredient' }) },
  { method: 'GET', path: `${WS}/garnishes/{garnishId}` },
  { method: 'GET', path: `${WS}/ice/{iceId}` },
  { method: 'GET', path: `${WS}/guest-menus/{menuId}` },
  { method: 'GET', path: `${WS}/guest-menus/{menuId}/export/html` },
  { method: 'GET', path: `${WS}/guest-menus/{menuId}/preview` },
  { method: 'GET', path: `${WS}/guest-menus/{menuId}/qr.svg` },
  { method: 'GET', path: `${WS}/guest-menus/active/extras`, query: (ids) => ({ cardId: ids.cardId }) },
  { method: 'PUT', path: `${WS}/guest-menus/reorder`, body: (ids) => ({ ids: [ids.menuId], menuIds: [ids.menuId] }) },
  { method: 'POST', path: `${WS}/guest-menus/templates`, body: () => templateBody('Coverage template') },
  { method: 'GET', path: `${WS}/guest-menus/templates/{templateId}` },
  { method: 'PUT', path: `${WS}/guest-menus/templates/{templateId}`, body: () => templateBody('Coverage template 2') },
  { method: 'PUT', path: `${WS}/queue/{queueItemId}` },
  { method: 'GET', path: `${WS}/statistics/advanced/cocktails`, query: () => RANGE },
  { method: 'GET', path: `${WS}/statistics/advanced/cocktails/{cocktailId}` },
  { method: 'GET', path: `${WS}/statistics/advanced/cocktails/{cocktailId}/orders` },
  { method: 'GET', path: `${WS}/statistics/advanced/compare`, query: () => ({ type: 'TAG_SET', items: 'COVERAGE tag', ...RANGE }) },
  { method: 'PUT', path: `${WS}/statistics/advanced/sets`, body: (ids) => ({ id: ids.setId, name: 'Coverage set' }) },
  { method: 'PUT', path: `${WS}/tags/categories`, body: (ids) => [{ id: ids.categoryId, name: { de: 'Coverage' }, order: 1, showAsGuestFilter: true }] },
  { method: 'POST', path: `${WS}/join-requests/{userId}/reject`, query: (ids) => ({ userId: ids.applicantUserId }) },
  { method: 'DELETE', path: `${WS}/join-codes/{code}` },
  { method: 'DELETE', path: `${WS}/statistics/cocktails/{cocktailStatisticId}` },
  { method: 'DELETE', path: `${WS}/statistics/logs/{cocktailStatisticId}`, query: (ids) => ({ cocktailStatisticId: ids.secondStatisticId }) },
  { method: 'DELETE', path: `${WS}/guest-menus/templates/{templateId}` },
  { method: 'DELETE', path: `${WS}/calculations/groups/{groupId}` },
  { method: 'DELETE', path: `${WS}/actions/{actionId}`, query: (ids) => ({ actionId: ids.unusedActionId }) },
];

describe('operation coverage happy paths (integration)', () => {
  it('answers 2xx for each operation on the caller’s own data', async () => {
    const { a } = await seedTenantPair();
    const graph = await seedTenantGraph(a, 'COVERAGE');
    const unusedAction = await prisma.workspaceCocktailRecipeStepAction.create({
      data: { name: 'Unused', actionGroup: 'MIXING', workspaceId: a.workspace.id },
    });
    const secondStatistic = await prisma.cocktailStatisticItem.create({
      data: { cocktailId: graph.ids.cocktailId, workspaceId: a.workspace.id, date: new Date() },
    });
    const ids = { ...graph.ids, unusedActionId: unusedAction.id, secondStatisticId: secondStatistic.id };
    const owner = roleUser(a, 'OWNER');
    const failures: string[] = [];

    for (const testCase of CASES) {
      const binding = handlerBindings.find((entry) => entry.apiDoc.basePath === testCase.path);
      const spec = binding?.apiDoc.operations[testCase.method];
      if (!binding || !spec) {
        failures.push(`${testCase.method} ${testCase.path}: unknown operation`);
        continue;
      }
      const query: Record<string, string> = { workspaceId: a.workspace.id };
      for (const match of testCase.path.matchAll(/\{(\w+)\}/g)) if (match[1] !== 'workspaceId') query[match[1]!] = ids[match[1]!]!;
      Object.assign(query, testCase.query?.(ids));
      const body = testCase.body ? testCase.body(ids) : spec.body ? sampleFromSchema(spec.body) : undefined;

      const result = await callAs(owner, binding.handler, { method: testCase.method, query, body });
      if (result.status < 200 || result.status >= 300) {
        failures.push(`${testCase.method} ${testCase.path}: ${result.status} ${JSON.stringify(result.json ?? '').slice(0, 300)}`);
      }
    }

    // The draft document is the only body the sample generator cannot build.
    const draft = handlerBindings.find((entry) => entry.apiDoc.basePath === `${WS}/guest-menus/{menuId}/draft`)!;
    const draftResult = await callAs(owner, draft.handler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, menuId: ids.menuId },
      body: createDefaultGuestMenuDocument(),
    });
    if (draftResult.status !== 200) failures.push(`PUT draft: ${draftResult.status}`);

    expect(failures, failures.join('\n')).toEqual([]);
  }, 120_000);
});
