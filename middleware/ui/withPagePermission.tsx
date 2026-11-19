import React, { useContext, useEffect, useRef } from 'react';
import { Role } from '@generated/prisma/client';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';

export type PagePermissionDecision = 'wait' | 'allow' | 'deny';

export interface PagePermissionState {
  /** `workspaceId` from the URL. */
  workspaceId: string | string[] | undefined;
  userLoaded: boolean;
  workspaceRefreshing: boolean;
  /** Id of the workspace currently held by the user context (may still be the previous page's workspace). */
  loadedWorkspaceId: string | undefined;
  isUserPermitted: (role: Role) => boolean;
}

/**
 * Decides only once the workspace from the URL is loaded. Right after a navigation (e.g. creating a workspace and
 * opening its setup) the context still holds no or the previous workspace: this page's effects run before
 * AuthBoundary's effect starts loading, so `workspaceRefreshing` is not set yet either.
 */
export function decidePagePermission(roles: Role[], state: PagePermissionState): PagePermissionDecision {
  const workspaceId = Array.isArray(state.workspaceId) ? state.workspaceId[0] : state.workspaceId;
  if (workspaceId == undefined) return 'wait';
  if (!state.userLoaded) return 'wait';
  if (state.workspaceRefreshing) return 'wait';
  if (state.loadedWorkspaceId !== workspaceId) return 'wait';
  if (roles.includes(Role.ADMIN) && state.isUserPermitted(Role.ADMIN)) return 'allow';
  if (roles.includes(Role.MANAGER) && state.isUserPermitted(Role.MANAGER)) return 'allow';
  if (roles.includes(Role.USER)) return 'allow';
  return 'deny';
}

export const withPagePermission = <P extends object>(roles: Role[], Component: React.ComponentType<P>, fallbackUrl: string) =>
  function WithPagePermission({ ...props }: P) {
    const router = useRouter();
    const userContext = useContext(UserContext);

    const decision = decidePagePermission(roles, {
      workspaceId: router.query.workspaceId,
      userLoaded: userContext.user != undefined,
      workspaceRefreshing: userContext.workspaceRefreshing,
      loadedWorkspaceId: userContext.workspace?.id,
      isUserPermitted: userContext.isUserPermitted,
    });

    // Effects can run again before the redirect finished (Strict Mode, router updates): redirect and warn only once.
    const redirecting = useRef(false);
    useEffect(() => {
      if (decision !== 'deny' || redirecting.current) return;
      redirecting.current = true;
      router
        .replace({
          pathname: fallbackUrl,
          query: {
            workspaceId: router.query.workspaceId,
          },
        })
        .then(() => alertService.error('Du hast keine Berechtigung für diese Seite'));
    }, [decision, router]);

    return <Component {...props} />;
  };
