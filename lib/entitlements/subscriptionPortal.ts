/**
 * "Abo verwalten" and "Upgrade" (plan card, limit dialog, status banner, suspended view): asks the app for a fresh
 * portal handoff (`POST /api/v1/workspaces/{workspaceId}/portal/handoff`) and navigates there. The token is signed per
 * click on the server and never rendered ahead of time. Pure module (no app imports), so it can be unit tested.
 */
import type { HandoffIntent, HandoffLocale } from '@lib/portal/constants';

/** Why the button cannot be used, or `ready`. */
export type PortalButtonState = 'unavailable' | 'notOwner' | 'emailNotVerified' | 'ready';

/**
 * - `unavailable`: the instance offers no handoff (`portalHandoff: false` of the workspace plan)
 * - `notOwner`: only owners may manage the subscription
 * - `emailNotVerified`: the portal lets only verified addresses in
 */
export function portalButtonState({ available, isOwner, emailVerified }: { available: boolean; isOwner: boolean; emailVerified: boolean }): PortalButtonState {
  if (!available) return 'unavailable';
  if (!isOwner) return 'notOwner';
  if (!emailVerified) return 'emailNotVerified';
  return 'ready';
}

/** A refused handoff; `code` is the `error.code` of the answer (e.g. `EMAIL_NOT_VERIFIED`) or `NETWORK`. */
export class PortalHandoffError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(`Portal handoff failed (${code})`);
    this.name = 'PortalHandoffError';
  }
}

/** Requests a handoff and answers the portal URL (`<PORTAL_URL>/sso?token=…`). Throws {@link PortalHandoffError}. */
export async function requestPortalHandoff(
  workspaceId: string,
  intent: HandoffIntent,
  locale: HandoffLocale,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/portal/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, locale }),
      cache: 'no-store',
    });
  } catch {
    throw new PortalHandoffError('NETWORK', 0);
  }
  const body = (await response.json().catch(() => null)) as { data?: { url?: unknown }; error?: { code?: unknown } } | null;
  if (!response.ok) {
    throw new PortalHandoffError(typeof body?.error?.code === 'string' ? body.error.code : 'ERROR', response.status);
  }
  const url = body?.data?.url;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new PortalHandoffError('ERROR', response.status);
  return url;
}

/** Opens the customer portal for the workspace: a top-level navigation, so the portal can set its cookie. */
export async function openSubscriptionPortal(
  workspaceId: string,
  intent: HandoffIntent,
  locale: HandoffLocale,
  navigate: (url: string) => void = (url) => window.location.assign(url),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  navigate(await requestPortalHandoff(workspaceId, intent, locale, fetchImpl));
}
