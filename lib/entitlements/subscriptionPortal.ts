/**
 * Integration point of the button "Abo verwalten" (plan card and limit dialog) for the portal handoff (task A3,
 * `POST /api/v1/workspaces/{workspaceId}/portal/handoff`). Until the handoff exists the button is shown disabled.
 * A3 replaces `openSubscriptionPortal` and sets `SUBSCRIPTION_PORTAL_AVAILABLE` to `true`. Pure module.
 */
export const SUBSCRIPTION_PORTAL_AVAILABLE: boolean = false;

/** Opens the customer portal for the workspace (handoff). No-op until A3 wires it. */
export async function openSubscriptionPortal(_workspaceId: string): Promise<void> {
  // A3: request the handoff URL and navigate to it.
}
