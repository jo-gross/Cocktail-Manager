/**
 * Configuration of the portal handoff (docs/ENTITLEMENTS.md "Portal handoff", docs/ENV.md). The handoff is available
 * only with `ENTITLEMENTS_MODE=managed`, a valid `PORTAL_HANDOFF_PRIVATE_KEY`, a valid `PORTAL_URL` and a public URL
 * of the app (`BETTER_AUTH_URL`, else `NEXTAUTH_URL`, else `NEXT_PUBLIC_APP_URL`) for `iss`. Invalid values are logged
 * once as a warning, never with the value.
 */
import type { KeyObject } from 'node:crypto';
import { entitlementsMode } from '@lib/instance/config';
import { issuerOrigin, parseHandoffPrivateKey } from './handoffToken';

export interface PortalHandoffConfig {
  privateKey: KeyObject;
  /** `PORTAL_URL` without trailing slash. */
  portalUrl: string;
  /** Origin of the app's public URL, the `iss` claim. */
  issuer: string;
}

let cachedKey: { raw: string; key: KeyObject | null } | null = null;
const warned = new Set<string>();

function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[portal handoff] ${message} The portal handoff ("Abo verwalten") is disabled; see docs/ENV.md.`);
}

/** The parsed key, re-parsed only when the env value changes. */
function privateKey(raw: string): KeyObject | null {
  if (cachedKey?.raw !== raw) cachedKey = { raw, key: parseHandoffPrivateKey(raw) };
  return cachedKey.key;
}

/** Public URL of the app the users sign in on; the same variables as the auth base URL (lib/auth.ts). */
export function appPublicUrl(): string | undefined {
  return process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;
}

/**
 * The handoff configuration, or `null` when it is incomplete or invalid. Does not look at `ENTITLEMENTS_MODE`; see
 * `portalHandoffConfig`.
 */
export function readPortalHandoffEnv(): PortalHandoffConfig | null {
  const rawKey = process.env.PORTAL_HANDOFF_PRIVATE_KEY?.trim();
  const rawPortalUrl = process.env.PORTAL_URL?.trim();
  if (!rawKey || !rawPortalUrl) return null;

  const key = privateKey(rawKey);
  if (!key) {
    warnOnce('key', 'PORTAL_HANDOFF_PRIVATE_KEY is not an Ed25519 private key in PKCS#8 PEM.');
    return null;
  }
  if (!issuerOrigin(rawPortalUrl)) {
    warnOnce('portalUrl', 'PORTAL_URL is not an http(s) URL.');
    return null;
  }
  const issuer = issuerOrigin(appPublicUrl());
  if (!issuer) {
    warnOnce('issuer', 'None of BETTER_AUTH_URL, NEXTAUTH_URL or NEXT_PUBLIC_APP_URL is a valid public URL of the app (needed as issuer).');
    return null;
  }
  return { privateKey: key, portalUrl: rawPortalUrl.replace(/\/+$/, ''), issuer };
}

/** The handoff configuration when the handoff is offered: `ENTITLEMENTS_MODE=managed` and complete, valid env. */
export function portalHandoffConfig(): PortalHandoffConfig | null {
  if (entitlementsMode() !== 'managed') return null;
  return readPortalHandoffEnv();
}

export function portalHandoffAvailable(): boolean {
  return portalHandoffConfig() !== null;
}
