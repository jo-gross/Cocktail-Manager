/**
 * Records which v1 operations integration tests invoke (and with which status),
 * so `test/globalSetup.ts` can enforce that every documented operation is
 * exercised successfully at least once. Active only when API_COVERAGE_FILE is set.
 */
import { appendFileSync } from 'node:fs';
import type { ApiHandler } from './invokeHandler';

export interface CoverageRecord {
  basePath: string;
  method: string;
  status: number;
}

let handlerIndex: Map<ApiHandler, string> | null = null;

async function basePathOf(handler: ApiHandler): Promise<string | undefined> {
  if (!handlerIndex) {
    const { handlerBindings } = await import('./handlerBindings');
    handlerIndex = new Map(handlerBindings.map((binding) => [binding.handler as ApiHandler, binding.apiDoc.basePath]));
  }
  return handlerIndex.get(handler);
}

export async function recordInvocation(handler: ApiHandler, method: string | undefined, status: number): Promise<void> {
  const file = process.env.API_COVERAGE_FILE;
  if (!file || !method) return;
  const basePath = await basePathOf(handler);
  if (!basePath) return;
  const record: CoverageRecord = { basePath, method: method.toUpperCase(), status };
  appendFileSync(file, `${JSON.stringify(record)}\n`);
}
