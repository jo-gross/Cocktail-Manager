/**
 * Configuration of the instance API (`/api/v1/instance/**`) the control plane uses. Pure module (no Prisma), so the
 * OpenAPI generator and unit tests can import it. See docs/INSTANCE-API.md.
 */

/** Version of the instance API contract (`apiVersion` of `GET /api/v1/instance`). */
export const INSTANCE_API_VERSION = '1';

/** Capability names of the contract. Only the ones in `INSTANCE_CAPABILITIES` are served by this build. */
export type InstanceCapability = 'instance.read' | 'entitlements' | 'announcements' | 'support.write';

/** Capabilities this build serves in every mode. Add a value once its routes exist. */
export const INSTANCE_CAPABILITIES: readonly InstanceCapability[] = ['instance.read'];

/** Capabilities only advertised with `ENTITLEMENTS_MODE=managed`: a self-hosted instance never gets these calls. */
export const MANAGED_INSTANCE_CAPABILITIES: readonly InstanceCapability[] = ['announcements', 'support.write'];

export const ENTITLEMENTS_MODES = ['off', 'managed'] as const;
export type EntitlementsMode = (typeof ENTITLEMENTS_MODES)[number];

/** `ENTITLEMENTS_MODE`: `off` (default, self-hosting) or `managed` (hosted by the control plane). */
export function parseEntitlementsMode(value: string | undefined): { mode: EntitlementsMode; valid: boolean } {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === '') return { mode: 'off', valid: true };
  if ((ENTITLEMENTS_MODES as readonly string[]).includes(normalized)) return { mode: normalized as EntitlementsMode, valid: true };
  return { mode: 'off', valid: false };
}

let warnedInvalidMode = false;

/** Current mode from the environment. Invalid values count as `off` and are logged once (without the value). */
export function entitlementsMode(): EntitlementsMode {
  const { mode, valid } = parseEntitlementsMode(process.env.ENTITLEMENTS_MODE);
  if (!valid && !warnedInvalidMode) {
    warnedInvalidMode = true;
    console.warn('ENTITLEMENTS_MODE has an invalid value; allowed are "off" and "managed". Using "off".');
  }
  return mode;
}

/** Capabilities reported by `GET /api/v1/instance` for the current (or given) mode. */
export function instanceCapabilities(mode: EntitlementsMode = entitlementsMode()): InstanceCapability[] {
  return mode === 'managed' ? [...INSTANCE_CAPABILITIES, ...MANAGED_INSTANCE_CAPABILITIES] : [...INSTANCE_CAPABILITIES];
}
