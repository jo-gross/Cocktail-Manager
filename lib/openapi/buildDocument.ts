/**
 * Builds the OpenAPI 3.1 document from the collected ResourceApiDocs.
 * Each v1 operation is emitted at /api/v1{basePath}; if legacyPath is not
 * disabled, a deprecated mirror is emitted at /api{basePath} (single source).
 *
 * The required API-key permission is surfaced three ways per operation:
 *  - as a 3.1 security "role name"        → security: [{ ApiKeyAuth: ['X'] }]
 *  - as a human-readable description line  → "Required API-key permission: `X`"
 *  - as a machine-readable extension       → x-required-permission: 'X'
 * The full catalog is documented via the `Permission` component schema.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { OPENAPI_TAG_GROUPS, OPENAPI_TAGS } from '@lib/openapi/tags';
import type { HttpVerb, ResourceApiDoc, RouteSpec } from '@lib/openapi/types';
import { ErrorResponse, dataEnvelope } from '@lib/schemas/common';
import { PERMISSION_DESCRIPTIONS, PermissionEnum } from '@lib/schemas/permissions';

export const API_VERSION = '1.0.0';

/**
 * Which surface to emit:
 *  - 'combined': canonical /api/v1 + a deprecated mirror of each legacy /api path (single download).
 *  - 'v1':       only the stable /api/v1 paths (no deprecation) — the "v1" docs version.
 *  - 'preview':  only the historic unversioned /api paths, documented on their own (not deprecated) — the "preview" docs version.
 */
export type ApiVariant = 'combined' | 'v1' | 'preview';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];
const errorContent = { 'application/json': { schema: ErrorResponse } };

function authNote(spec: RouteSpec): string {
  if (spec.sessionOnly) {
    return '**Authentication:** requires a logged-in workspace-member session. API keys (workspace or the instance master key) are NOT accepted for this operation.';
  }
  if (!spec.permission) {
    return '**Authentication:** requires a valid session or API key (no specific permission).';
  }
  const description = PERMISSION_DESCRIPTIONS[spec.permission];
  return `**Required API-key permission:** \`${spec.permission}\`${description ? ` — ${description}` : ''}`;
}

function successResponse(spec: RouteSpec) {
  if (spec.rawResponse) {
    return {
      description: spec.rawResponse.description ?? spec.summary,
      content: Object.fromEntries(spec.rawResponse.contentTypes.map((ct) => [ct, { schema: { type: 'string', format: 'binary' } }])),
    };
  }
  return {
    description: spec.summary,
    content: { 'application/json': { schema: dataEnvelope(spec.response!) } },
  };
}

export function buildOpenApiDocument(resources: ResourceApiDoc[], variant: ApiVariant = 'combined') {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'WorkspaceApiKeyAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Workspace API key (JWT), scoped to a single workspace. Create one under Workspace → Settings → API Keys ' +
      'and send it as `Authorization: Bearer <token>`. Each key carries a set of permissions; the required ' +
      'permission is documented per operation (see the `Permission` schema for the full list).',
  });

  registry.registerComponent('securitySchemes', 'InstanceApiKeyAuth', {
    type: 'http',
    scheme: 'bearer',
    description:
      'Instance master API key — the `INSTANCE_MASTER_API_KEY` server env value, sent as ' +
      '`Authorization: Bearer <token>`. It is instance-wide (NOT scoped to a workspace) and bypasses the ' +
      'per-operation permission checks, so it authorizes every workspace operation. Intended for self-hosting / ' +
      'instance administration, not for third-party integrations. Call `GET /me` to introspect a token (its ' +
      '`isMaster` flag is true for this key).',
  });

  registry.registerComponent('securitySchemes', 'SessionCookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description:
      'Logged-in user session (browser cookie). Used by the few workspace-member operations that act on the ' +
      "caller's own identity (e.g. leaving a workspace, creating/revoking API keys) and therefore do NOT accept " +
      'API keys — neither a workspace key nor the instance master key.',
  });

  // Documented in components even though it is referenced only from descriptions.
  registry.register('Permission', PermissionEnum);

  const registerOperation = (fullPath: string, method: HttpVerb, spec: RouteSpec, successor?: string) => {
    const deprecated = successor !== undefined;

    const request: Record<string, unknown> = {};
    if (spec.params) request.params = spec.params;
    if (spec.query) request.query = spec.query;
    if (spec.body) request.body = { content: { 'application/json': { schema: spec.body } } };

    const responses: Record<number, unknown> = {
      [spec.status ?? 200]: successResponse(spec),
      400: { description: 'Validation error', content: errorContent },
      401: { description: 'Missing or invalid credentials', content: errorContent },
      403: { description: 'Insufficient permissions', content: errorContent },
    };
    for (const [code, description] of Object.entries(spec.errorResponses ?? {})) {
      responses[Number(code)] = { description, content: errorContent };
    }

    const description = [
      authNote(spec),
      deprecated
        ? `**Deprecated.** Use \`${successor}\` instead. This unversioned endpoint keeps its historic behavior but may be removed in a future release.`
        : spec.description,
    ]
      .filter(Boolean)
      .join('\n\n');

    registry.registerPath({
      method: method.toLowerCase() as Lowercase<HttpVerb>,
      path: fullPath,
      summary: deprecated ? `[Deprecated] ${spec.summary}` : spec.summary,
      description,
      tags: spec.tags,
      deprecated: deprecated || undefined,
      security: spec.sessionOnly
        ? [{ SessionCookieAuth: [] }]
        : spec.permission
          ? [{ WorkspaceApiKeyAuth: [spec.permission] }, { InstanceApiKeyAuth: [] }]
          : [{ WorkspaceApiKeyAuth: [] }, { InstanceApiKeyAuth: [] }],
      request: Object.keys(request).length > 0 ? request : undefined,
      responses: responses as Parameters<typeof registry.registerPath>[0]['responses'],
    });
  };

  for (const resource of resources) {
    const emitLegacy = resource.legacyPath !== false;
    for (const [method, spec] of Object.entries(resource.operations) as Array<[HttpVerb, RouteSpec]>) {
      const v1Path = `/api/v1${resource.basePath}`;
      const legacyPath = `/api${resource.basePath}`;
      if (variant === 'v1') {
        registerOperation(v1Path, method, spec);
      } else if (variant === 'preview') {
        // The "preview" surface is the historic unversioned API — documented on its
        // own (non-deprecated) so consumers can switch to it in the docs version picker.
        if (emitLegacy) registerOperation(legacyPath, method, spec);
      } else {
        // combined: canonical v1 + a deprecated mirror of the legacy path (single source of truth).
        registerOperation(v1Path, method, spec);
        if (emitLegacy) registerOperation(legacyPath, method, spec, v1Path);
      }
    }
  }

  const info = {
    combined: {
      title: 'Cocktail Manager API',
      description:
        'External REST API of the Cocktail Manager. Authenticate with a workspace API key (Bearer JWT). ' +
        'The `/api/v1` paths are the stable, versioned contract; unversioned paths are deprecated.',
    },
    v1: {
      title: 'Cocktail Manager API',
      description:
        'Stable, versioned (`/api/v1`) REST API of the Cocktail Manager. Authenticate with a workspace ' +
        'API key (Bearer JWT). This is the recommended contract for all integrations.',
    },
    preview: {
      title: 'Cocktail Manager API (Preview)',
      description:
        'Preview surface: the historic, unversioned (`/api`) REST API. Kept for backwards compatibility — ' +
        'new integrations should switch to the stable **v1** version. Authenticate with a workspace API key (Bearer JWT).',
    },
  }[variant];

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: API_VERSION,
      description: info.description,
    },
    servers: [
      { url: 'https://app.cocktail-manager.de', description: 'Produktion' },
      { url: 'https://staging.cocktail-manager.de', description: 'Staging' },
      { url: 'http://localhost:3000', description: 'Lokale Entwicklung' },
    ],
    security: [{ WorkspaceApiKeyAuth: [] }, { InstanceApiKeyAuth: [] }],
  });

  // Mirror the required permission as a machine-readable extension (derived from
  // the security scope so it never drifts from what is enforced).
  for (const pathItem of Object.values(doc.paths ?? {}) as Array<Record<string, { security?: Array<Record<string, string[]>> }>>) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.includes(method) || !operation || typeof operation !== 'object') continue;
      const scope = operation.security?.[0]?.WorkspaceApiKeyAuth?.[0];
      if (scope) {
        (operation as Record<string, unknown>)['x-required-permission'] = scope;
      }
    }
  }

  const enriched = doc as unknown as Record<string, unknown>;
  enriched.tags = OPENAPI_TAGS;
  enriched['x-tagGroups'] = OPENAPI_TAG_GROUPS;

  return doc;
}
