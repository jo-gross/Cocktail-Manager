/**
 * Flattens ResourceApiDocs into per-operation records for parametrized tests
 * (auth matrix, contract guards, handler wiring).
 */
import type { HttpVerb, ResourceApiDoc, RouteSpec } from '@lib/openapi/types';
import { collectResourceApiDocs } from '../../scripts/generate-openapi';

export interface FlatOperation {
  basePath: string;
  method: HttpVerb;
  spec: RouteSpec;
  /** Full v1 path, e.g. /api/v1/workspaces/{workspaceId}/glasses */
  v1Path: string;
}

export function flattenResourceApiDoc(resource: ResourceApiDoc): FlatOperation[] {
  return (Object.keys(resource.operations) as HttpVerb[]).map((method) => ({
    basePath: resource.basePath,
    method,
    spec: resource.operations[method]!,
    v1Path: `/api/v1${resource.basePath}`,
  }));
}

export async function flattenOperations(): Promise<FlatOperation[]> {
  const resources = await collectResourceApiDocs();
  return resources.flatMap(flattenResourceApiDoc);
}
