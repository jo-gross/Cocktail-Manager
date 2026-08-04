import { describe, it, expect } from 'vitest';
import { collectResourceApiDocs } from '../../scripts/generate-openapi';
import { flattenOperations, flattenResourceApiDoc } from '@lib/openapi/flattenOperations';
import { handlerBindings } from '@test/helpers/handlerBindings';
import type { HttpVerb } from '@lib/openapi/types';

describe('API contract guards', () => {
  it('has a handler binding for every ResourceApiDoc from schemas', async () => {
    const resources = await collectResourceApiDocs();
    const boundPaths = new Set(handlerBindings.map((b) => b.apiDoc.basePath));

    for (const resource of resources) {
      expect(boundPaths.has(resource.basePath), `handler binding for ${resource.basePath}`).toBe(true);
    }
  });

  it('handler bindings cover every declared HTTP method per ResourceApiDoc', async () => {
    const resources = await collectResourceApiDocs();

    for (const resource of resources) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === resource.basePath);
      expect(binding, `binding for ${resource.basePath}`).toBeDefined();
      expect(binding!.apiDoc.operations).toEqual(resource.operations);
    }
  });

  it('every operation declares roles and permission (explicit null allowed)', async () => {
    const operations = await flattenOperations();

    for (const op of operations) {
      expect(Array.isArray(op.spec.roles) && op.spec.roles.length > 0, `${op.method} ${op.basePath} roles`).toBe(true);
      expect('permission' in op.spec, `${op.method} ${op.basePath} permission key`).toBe(true);
    }
  });

  it('every operation documents a success response shape', async () => {
    const operations = await flattenOperations();

    for (const op of operations) {
      const hasResponse = op.spec.response !== undefined || op.spec.rawResponse !== undefined;
      expect(hasResponse, `${op.method} ${op.basePath} response`).toBe(true);
    }
  });

  it('flattenOperations returns one entry per HTTP method', async () => {
    const resources = await collectResourceApiDocs();
    const flat = await flattenOperations();
    const expectedCount = resources.reduce((sum, r) => sum + Object.keys(r.operations).length, 0);
    expect(flat.length).toBe(expectedCount);
  });

  it('flattenResourceApiDoc builds correct v1 paths', () => {
    const ops = flattenResourceApiDoc({
      basePath: '/workspaces/{workspaceId}/glasses',
      operations: { GET: { roles: ['USER'], permission: 'GLASSES_READ', tags: [], summary: 'x' } },
    });
    expect(ops[0]!.v1Path).toBe('/api/v1/workspaces/{workspaceId}/glasses');
    expect(ops[0]!.method).toBe('GET');
  });

  it('handler bindings count matches ResourceApiDoc count', async () => {
    const resources = await collectResourceApiDocs();
    expect(handlerBindings.length).toBe(resources.length);
  });

  it('no duplicate handler binding basePaths', () => {
    const paths = handlerBindings.map((b) => b.apiDoc.basePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('sessionOnly operations are a known subset', async () => {
    const operations = await flattenOperations();
    const sessionOnly = operations.filter((op) => op.spec.sessionOnly);

    for (const op of sessionOnly) {
      expect(op.spec.sessionOnly, `${op.method} ${op.basePath}`).toBe(true);
    }

    const sessionOnlyPaths = sessionOnly.map((op) => `${op.method} ${op.basePath}`).sort();
    expect(sessionOnlyPaths.length).toBeGreaterThan(0);
    // Known session-only endpoints
    expect(sessionOnlyPaths).toContain('POST /workspaces/{workspaceId}/leave');
    expect(sessionOnlyPaths.some((p) => p.includes('/api-keys'))).toBe(true);
  });
});

describe('handler wiring completeness', () => {
  it('every binding references the same basePath in apiDoc', () => {
    for (const binding of handlerBindings) {
      expect(binding.apiDoc.basePath).toBeTruthy();
      expect(typeof binding.handler).toBe('function');
    }
  });

  it('all HTTP verbs in bindings are valid', () => {
    const validVerbs: HttpVerb[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const binding of handlerBindings) {
      for (const method of Object.keys(binding.apiDoc.operations)) {
        expect(validVerbs).toContain(method);
      }
    }
  });
});
