/**
 * Entitlement snapshots pushed by the control plane and the decisions derived from them. Pure module (zod only, no
 * Prisma), so the OpenAPI generator, the UI and unit tests can import it. See docs/ENTITLEMENTS.md.
 *
 * The wire format mirrors `SnapshotWireSchema` of the control plane (`@cm/core`) and `SnapshotWire` of the contract
 * `contracts/instance-api.openapi.yaml`: every limit key is present, `null` means unlimited.
 */
import { z } from '@lib/openapi/zod';
import type { EntitlementsMode } from '@lib/instance/config';

export const LIMIT_KEYS = ['cocktails', 'members', 'calculations', 'guestMenusPublished', 'signageScreens', 'apiKeys'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

/** Feature keys the app checks. The snapshot may carry more (`templates:<key>`, `beta:<flag>`); they are stored as is. */
export const FEATURE_KEYS = ['statistics.advanced', 'signage', 'api', 'branding.remove'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Instance-wide limit from the default; not part of the wire snapshot (see docs/ENTITLEMENTS.md). */
export const FREE_WORKSPACES_KEY = 'freeWorkspacesPerOwner';

export const ENTITLEMENT_STATUSES = ['ACTIVE', 'GRACE', 'READ_ONLY', 'SUSPENDED'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

const MAX_FEATURES = 200;
const LimitValue = z.number().int().min(0).max(1_000_000_000).nullable();

export const LocalizedNameSchema = z.object({ de: z.string().min(1).max(200), en: z.string().min(1).max(200) }).openapi('EntitlementPlanName');

/** Known limit keys are required and strictly typed; unknown keys (newer control planes) are stripped. */
export const SnapshotLimitsSchema = z
  .object({
    cocktails: LimitValue.openapi({ description: 'Cocktails that are not archived.' }),
    members: LimitValue,
    calculations: LimitValue,
    guestMenusPublished: LimitValue.openapi({ description: 'Guest menus with a published version.' }),
    signageScreens: LimitValue.openapi({ description: 'Configured monitor formats.' }),
    apiKeys: LimitValue.openapi({ description: 'Workspace API keys that are neither revoked nor expired.' }),
  })
  .openapi('EntitlementLimits', { description: 'Complete limit set; `null` means unlimited.' });

/**
 * End of a cancelled subscription: until `at` the plan of the snapshot applies, then `planKey`/`planName` (the instance
 * default plan). Information for the plan card only: the app never switches plans itself, the control plane pushes the
 * new snapshot when the subscription has ended.
 */
export const ScheduledEndSchema = z
  .object({
    at: z.iso.datetime({ offset: true }),
    planKey: z.string().min(1).max(64),
    planName: LocalizedNameSchema,
  })
  .openapi('EntitlementScheduledEnd', { description: 'Scheduled end of the subscription and the plan that applies afterwards.' });

export type ScheduledEnd = z.infer<typeof ScheduledEndSchema>;

/**
 * Validation of a pushed snapshot. Forward compatible: unknown top-level fields and unknown limit keys are stripped, so a
 * newer control plane can add fields; every known field is required and strictly typed. Only `scheduledEnd` may be
 * missing (older control planes); when present it is `null` or strictly typed. The stored `hash` stays the one the
 * control plane computed over its full content.
 */
export const SnapshotWireSchema = z
  .object({
    version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    hash: z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 as 64 lowercase hex characters'),
    planKey: z.string().min(1).max(64),
    planName: LocalizedNameSchema,
    status: z.enum(ENTITLEMENT_STATUSES),
    limits: SnapshotLimitsSchema,
    features: z.array(z.string().min(1).max(100)).max(MAX_FEATURES),
    billing: z.enum(['portal', 'contact']),
    nextChangeAt: z.iso.datetime({ offset: true }).nullable(),
    scheduledEnd: ScheduledEndSchema.nullable().optional(),
  })
  .openapi('EntitlementSnapshot', { description: 'Snapshot as pushed by the control plane (`SnapshotWire` of the contract).' });

export type SnapshotWire = z.infer<typeof SnapshotWireSchema>;
export type SnapshotLimits = z.infer<typeof SnapshotLimitsSchema>;

export type SnapshotSource = 'workspace' | 'default';

export interface EffectiveSnapshot {
  snapshot: SnapshotWire;
  source: SnapshotSource;
}

/**
 * The snapshot that applies to a workspace: its own, otherwise the instance default. `null` means nothing is
 * checked: always with `ENTITLEMENTS_MODE=off`, and in `managed` mode until the control plane pushed a snapshot.
 */
export function effectiveSnapshot(mode: EntitlementsMode, workspace: SnapshotWire | null, instanceDefault: SnapshotWire | null): EffectiveSnapshot | null {
  if (mode !== 'managed') return null;
  if (workspace) return { snapshot: workspace, source: 'workspace' };
  if (instanceDefault) return { snapshot: instanceDefault, source: 'default' };
  return null;
}

/**
 * Version rule of the contract: a push applies only when its version is higher than the stored one. A stored snapshot
 * that no longer parses (`currentReadable: false`) is also replaced by a push of the same version.
 */
export function shouldApply(currentVersion: number | null, incomingVersion: number, currentReadable = true): boolean {
  if (!currentReadable) return incomingVersion >= (currentVersion ?? 0);
  return incomingVersion > (currentVersion ?? 0);
}

export interface StoredSnapshot {
  snapshot: SnapshotWire;
  /** Names of the fields that did not parse (no values), empty when the stored snapshot is valid. */
  invalidFields: string[];
}

/**
 * Lenient read of a stored snapshot (rows are validated on write, but a newer app may validate stricter). Every valid
 * known field is kept; a field that does not parse counts as unrestricted (limit `null`, status `ACTIVE`, the known
 * features, `billing: contact`), like a workspace before its first push. A paid workspace therefore never drops to the
 * free default because one field is unreadable. `null` only for a value that is not an object.
 */
export function readStoredSnapshot(value: unknown, columns: { version?: number; hash?: string } = {}): StoredSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const strict = SnapshotWireSchema.safeParse(value);
  if (strict.success) return { snapshot: strict.data, invalidFields: [] };

  const record = value as Record<string, unknown>;
  const invalidFields: string[] = [];
  const field = <S extends z.ZodType>(name: keyof SnapshotWire, schema: S, fallback: z.infer<S>, source: unknown = record[name]): z.infer<S> => {
    const parsed = schema.safeParse(source);
    if (parsed.success) return parsed.data;
    invalidFields.push(name);
    return fallback;
  };
  const shape = SnapshotWireSchema.shape;

  const version = columns.version ?? field('version', shape.version, 0);
  const hash = columns.hash ?? field('hash', shape.hash, '');
  const planKey = field('planKey', shape.planKey, '');
  const planName = field('planName', shape.planName, { de: planKey || '–', en: planKey || '–' });
  const status = field('status', shape.status, 'ACTIVE');
  const rawLimits = record.limits && typeof record.limits === 'object' && !Array.isArray(record.limits) ? (record.limits as Record<string, unknown>) : {};
  const limits = Object.fromEntries(
    LIMIT_KEYS.map((key) => {
      const parsed = LimitValue.safeParse(rawLimits[key]);
      if (!parsed.success) invalidFields.push(`limits.${key}`);
      return [key, parsed.success ? parsed.data : null];
    }),
  ) as SnapshotLimits;
  const features = Array.isArray(record.features)
    ? record.features.filter((feature): feature is string => {
        const ok = typeof feature === 'string' && feature.length >= 1 && feature.length <= 100;
        if (!ok && !invalidFields.includes('features')) invalidFields.push('features');
        return ok;
      })
    : field('features', shape.features, [...FEATURE_KEYS]);
  const billing = field('billing', shape.billing, 'contact');
  const nextChangeAt = field('nextChangeAt', shape.nextChangeAt, null);
  const scheduledEnd = field('scheduledEnd', shape.scheduledEnd, null) ?? null;

  return { snapshot: { version, hash, planKey, planName, status, limits, features, billing, nextChangeAt, scheduledEnd }, invalidFields };
}

export function hasFeature(effective: EffectiveSnapshot | null, feature: FeatureKey): boolean {
  if (!effective) return true;
  return effective.snapshot.features.includes(feature);
}

export function limitOf(effective: EffectiveSnapshot | null, key: LimitKey): number | null {
  if (!effective) return null;
  return effective.snapshot.limits[key] ?? null;
}

export type LimitDecision = { allowed: true } | { allowed: false; limit: number; current: number };

/**
 * A write may not raise a count above the limit. Writes that do not raise it stay allowed, so a workspace over its
 * limit after a downgrade can still edit, archive and delete (nothing is ever removed).
 */
export function decideLimit(limit: number | null, before: number, after: number): LimitDecision {
  if (limit === null || after <= before || after <= limit) return { allowed: true };
  return { allowed: false, limit, current: before };
}

// ---------------------------------------------------------------------------
// Status gate
// ---------------------------------------------------------------------------

/** Statuses in which a route stays available although the status would block it (see `withStatusExemption`). */
export type RestrictedStatus = 'READ_ONLY' | 'SUSPENDED';

export type StatusDecision = { allowed: true } | { allowed: false; code: 'WORKSPACE_READ_ONLY' | 'WORKSPACE_SUSPENDED' };

/**
 * - `ACTIVE`, `GRACE`: everything.
 * - `READ_ONLY`: `GET`/`HEAD`/`OPTIONS`, plus routes exempt for `READ_ONLY` (export, leave, delete, handoff).
 * - `SUSPENDED`: only routes exempt for `SUSPENDED` (status view, export, leave, delete).
 */
export function decideStatus(status: EntitlementStatus, method: string | undefined, exemptFor: readonly RestrictedStatus[] = []): StatusDecision {
  if (status === 'ACTIVE' || status === 'GRACE') return { allowed: true };
  if (exemptFor.includes(status)) return { allowed: true };
  if (status === 'READ_ONLY') {
    const verb = (method ?? 'GET').toUpperCase();
    return verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS' ? { allowed: true } : { allowed: false, code: 'WORKSPACE_READ_ONLY' };
  }
  return { allowed: false, code: 'WORKSPACE_SUSPENDED' };
}

// ---------------------------------------------------------------------------
// Free workspaces per owner
// ---------------------------------------------------------------------------

/** `ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER`: a non-negative integer, otherwise unlimited (`null`). */
export function parseFreeWorkspacesPerOwner(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? '';
  if (!/^\d{1,9}$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** A workspace counts as free when it runs on the instance default plan (no own snapshot, or one with the default's plan key). */
export function isFreeWorkspace(workspacePlanKey: string | null, defaultPlanKey: string): boolean {
  return workspacePlanKey === null || workspacePlanKey === defaultPlanKey;
}
