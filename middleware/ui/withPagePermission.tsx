import React, { useContext, useEffect } from 'react';
import { Role } from '@generated/prisma/client';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';

export const withPagePermission = <P extends object>(roles: Role[], Component: React.ComponentType<P>, fallbackUrl: string) =>
  function WithPagePermission({ ...props }: P) {
    const router = useRouter();
    const userContext = useContext(UserContext);

    useEffect(() => {
      if (router.query.workspaceId == undefined) return;
      if (userContext.user == undefined) return;
      if (userContext.workspaceRefreshing) return;
      if (roles.includes(Role.ADMIN) && userContext.isUserPermitted(Role.ADMIN)) {
        return;
      } else if (roles.includes(Role.MANAGER) && userContext.isUserPermitted(Role.MANAGER)) {
        return;
      } else if (roles.includes(Role.USER)) {
        return;
      } else {
        router
          .replace({
            pathname: fallbackUrl,
            query: {
              workspaceId: router.query.workspaceId,
            },
          })
          // .replace(`/workspaces/${router.query.workspaceId}/manage`)
          .then(() => alertService.error('Du hast keine Berechtigung für diese Seite'));
      }
    }, [router.query.workspaceId, router.asPath, userContext.workspaceRefreshing, router, userContext]);

    return <Component {...props} />;
  };
