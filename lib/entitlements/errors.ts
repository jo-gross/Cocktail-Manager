/**
 * 402 errors of the entitlement guards. The details `{ key, limit, current }` travel as `error.issues` of the usual
 * v1 error envelope, so every client that reads `{ error: { code, message, issues } }` gets them. Pure module.
 */
import { ApiError } from '@lib/http/ApiError';
import type { FeatureKey, LimitKey, StatusDecision } from './snapshot';
import { FREE_WORKSPACES_KEY } from './snapshot';

export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED';
export const PLAN_FEATURE_MISSING = 'PLAN_FEATURE_MISSING';

/** `error.issues` of a 402 response. `limit`/`current` are `null` for missing features and blocked statuses. */
export interface PlanErrorDetails {
  key: string;
  limit: number | null;
  current: number | null;
}

export function planLimitReached(key: LimitKey | typeof FREE_WORKSPACES_KEY, limit: number, current: number): ApiError {
  const details: PlanErrorDetails = { key, limit, current };
  return new ApiError(402, PLAN_LIMIT_REACHED, `The plan allows at most ${limit} (${key})`, details);
}

export function planFeatureMissing(feature: FeatureKey): ApiError {
  const details: PlanErrorDetails = { key: feature, limit: null, current: null };
  return new ApiError(402, PLAN_FEATURE_MISSING, `The plan does not include ${feature}`, details);
}

export function workspaceStatusBlocked(decision: Extract<StatusDecision, { allowed: false }>): ApiError {
  const details: PlanErrorDetails = { key: 'status', limit: null, current: null };
  const message = decision.code === 'WORKSPACE_READ_ONLY' ? 'The workspace is read-only' : 'The workspace is suspended';
  return new ApiError(402, decision.code, message, details);
}

/** Error codes the UI answers with the plan dialog. */
export const PLAN_ERROR_CODES = [PLAN_LIMIT_REACHED, PLAN_FEATURE_MISSING, 'WORKSPACE_READ_ONLY', 'WORKSPACE_SUSPENDED'] as const;
