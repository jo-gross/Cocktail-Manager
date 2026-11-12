import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectResourceApiDocs, generateOpenApiJson } from '../../scripts/generate-openapi';

describe('OpenAPI spec generation', () => {
  it('committed openapi/openapi.json is up to date (drift guard)', async () => {
    const generated = await generateOpenApiJson();
    const committed = readFileSync('openapi/openapi.json', 'utf8');
    expect(committed).toBe(generated);
  });

  it('committed v1.json matches openapi.json (drift guard)', () => {
    expect(readFileSync('openapi/v1.json', 'utf8')).toBe(readFileSync('openapi/openapi.json', 'utf8'));
  });

  it('produces a valid OpenAPI 3.1 document', async () => {
    const doc = JSON.parse(await generateOpenApiJson());
    expect(doc.openapi).toBe('3.1.0');
    const mod: Record<string, unknown> = await import('@readme/openapi-parser');
    const Parser = (mod.default ?? (mod as { OpenAPIParser?: unknown }).OpenAPIParser ?? mod) as {
      validate: (d: unknown) => Promise<unknown>;
    };
    await expect(Parser.validate(structuredClone(doc))).resolves.toBeTruthy();
  });

  it('documents only the versioned /api/v1 surface (no deprecated legacy mirrors)', async () => {
    const doc = JSON.parse(await generateOpenApiJson());
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.startsWith('/api/v1/'), `${path} should be a v1 path`).toBe(true);
      for (const method of Object.keys(doc.paths[path])) {
        expect(doc.paths[path][method].deprecated, `${method} ${path} not deprecated`).toBeUndefined();
      }
    }
  });

  it('gives every v1 operation a security requirement and documents both API-key kinds', async () => {
    const doc = JSON.parse(await generateOpenApiJson());
    for (const path of Object.keys(doc.paths).filter((p) => p.startsWith('/api/v1/'))) {
      for (const method of Object.keys(doc.paths[path])) {
        const op = doc.paths[path][method];
        expect(Array.isArray(op.security) && op.security.length > 0, `${method} ${path} security`).toBe(true);
      }
    }
    // Two distinct API-key kinds (workspace-scoped vs instance master) plus the session-only scheme.
    expect(doc.components.securitySchemes.WorkspaceApiKeyAuth).toBeDefined();
    expect(doc.components.securitySchemes.InstanceApiKeyAuth).toBeDefined();
    expect(doc.components.securitySchemes.SessionCookieAuth).toBeDefined();
  });

  it('has a real pages/api/v1 route file behind every documented resource', async () => {
    const resources = await collectResourceApiDocs();
    expect(resources.length).toBeGreaterThan(0);
    for (const resource of resources) {
      const rel = resource.basePath.replace(/\{(\w+)\}/g, '[$1]');
      // Pages Router allows either a folder route (…/x/index.ts) or a flat file (…/x.ts).
      const candidates = [`${rel}/index.ts`, `${rel}/index.tsx`, `${rel}.ts`, `${rel}.tsx`];
      const exists = candidates.some((c) => existsSync(resolve(`pages/api/v1${c}`)));
      expect(exists, `route file for ${resource.basePath}`).toBe(true);
    }
  });

  it('documents the required permission per operation and a Permission catalog', async () => {
    const doc = JSON.parse(await generateOpenApiJson());
    expect(doc.components.schemas.Permission?.enum?.length).toBeGreaterThan(0);

    for (const path of Object.keys(doc.paths).filter((p) => p.startsWith('/api/v1/'))) {
      for (const method of Object.keys(doc.paths[path])) {
        const op = doc.paths[path][method];
        const scope = op.security?.[0]?.WorkspaceApiKeyAuth?.[0];
        if (!scope) continue;
        expect(op['x-required-permission'], `${method} ${path} x-required-permission`).toBe(scope);
        expect(op.description, `${method} ${path} description mentions permission`).toContain(scope);
        expect(doc.components.schemas.Permission.enum, `${scope} in Permission catalog`).toContain(scope);
      }
    }
  });
});
