/**
 * Client-side notification of plan errors (402 from the entitlement guards), so the plan dialog opens wherever a
 * request was refused. `apiV1Fetch` reports them; `PlanBoundary` listens. Pure module.
 */
import { PLAN_ERROR_CODES, type PlanErrorDetails } from './errors';

export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export interface PlanErrorEvent {
  code: PlanErrorCode;
  details: PlanErrorDetails | null;
}

type Listener = (event: PlanErrorEvent) => void;

const listeners = new Set<Listener>();

export function isPlanErrorCode(code: unknown): code is PlanErrorCode {
  return typeof code === 'string' && (PLAN_ERROR_CODES as readonly string[]).includes(code);
}

function toDetails(issues: unknown): PlanErrorDetails | null {
  if (!issues || typeof issues !== 'object' || Array.isArray(issues)) return null;
  const record = issues as Record<string, unknown>;
  if (typeof record.key !== 'string') return null;
  const number = (value: unknown) => (typeof value === 'number' ? value : null);
  return { key: record.key, limit: number(record.limit), current: number(record.current) };
}

/** Reports a failed response; only 402 responses with a plan error code reach the listeners. */
export function reportPlanError(status: number, code: unknown, issues: unknown): void {
  if (status !== 402 || !isPlanErrorCode(code)) return;
  const event: PlanErrorEvent = { code, details: toDetails(issues) };
  for (const listener of listeners) listener(event);
}

/** For raw `fetch` callers: reports a parsed v1 error body (`{ error: { code, issues } }`) like `apiV1Fetch` does. */
export function reportPlanErrorResponse(status: number, body: unknown): void {
  const error = body && typeof body === 'object' ? (body as { error?: { code?: unknown; issues?: unknown } }).error : undefined;
  reportPlanError(status, error?.code, error?.issues);
}

export function onPlanError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
