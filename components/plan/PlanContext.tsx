import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { getWorkspaceEntitlement } from '@lib/network/entitlements';
import { useEntitlementsMode } from '@lib/network/entitlementsMode';

export interface PlanContextValue {
  workspaceId: string | null;
  /** `null` while loading, without workspace or when the request failed. */
  entitlement: WorkspaceEntitlementDto | null;
  refresh: () => void;
}

export const PlanContext = createContext<PlanContextValue>({ workspaceId: null, entitlement: null, refresh: () => undefined });

export function usePlan(): PlanContextValue {
  return useContext(PlanContext);
}

/**
 * Loads the plan of the current workspace once per workspace (and on `refresh`). Only with `ENTITLEMENTS_MODE=managed`:
 * self-hosted instances (`off`) never request it.
 */
export function PlanProvider({ workspaceId, children }: { workspaceId: string | null; children: React.ReactNode }) {
  const mode = useEntitlementsMode(workspaceId !== null);
  // Keyed by workspace, so switching workspaces never shows the plan of the previous one.
  const [loaded, setLoaded] = useState<{ workspaceId: string; entitlement: WorkspaceEntitlementDto } | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!workspaceId || mode !== 'managed') return;
    const controller = new AbortController();
    getWorkspaceEntitlement(workspaceId, controller.signal)
      .then((entitlement) => setLoaded({ workspaceId, entitlement }))
      // Without the plan the app simply shows no plan UI; the guards still answer on the server.
      .catch((error) => {
        if (!controller.signal.aborted) console.error('PlanProvider -> getWorkspaceEntitlement', error);
      });
    return () => controller.abort();
  }, [workspaceId, version, mode]);

  const entitlement = workspaceId && loaded?.workspaceId === workspaceId ? loaded.entitlement : null;
  return <PlanContext.Provider value={{ workspaceId, entitlement, refresh }}>{children}</PlanContext.Provider>;
}
