import React, { useCallback, useEffect, useState } from 'react';
import { authClient } from '@lib/auth-client';
import { Role, User, UserSetting } from '@generated/prisma/client';
import { PageCenter } from '../PageCenter';
import { Loading } from '../../Loading';
import { Button } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import type { WorkspaceDto } from '@lib/schemas/workspace';
import type { TranslationsDto } from '@lib/schemas/translations';
import { getTranslations, getWorkspace } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AuthBoundary(props: AlertBoundaryProps) {
  // Use BetterAuth's useSession hook
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [user, setUser] = useState<(User & { settings: UserSetting[] }) | undefined>();
  const [userLoading, setUserLoading] = useState<boolean>(false);

  const [workspace, setWorkspace] = useState<WorkspaceDto | undefined>();
  const [translations, setTranslations] = useState<TranslationsDto>({});
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(false);

  const router = useRouter();

  const cancelLogin = useCallback(async () => {
    await authClient.signOut();
    setUserLoading(false);
  }, []);

  const fetchUser = useCallback(() => {
    fetch(`/api/users`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setUser(body.data);
        } else {
          console.error('AuthBoundary -> fetchUser', response);
          alertService.error(body.error?.message ?? body.message ?? 'Fehler beim Laden des Nutzers', response.status, response.statusText);
          await authClient.signOut();
        }
      })
      .catch(async (error) => {
        console.error('AuthBoundary -> fetchUser', error);
        alertService.error('Fehler beim Laden des Nutzers');
        await authClient.signOut();
      })
      .finally(async () => {
        setUserLoading(false);
      });
  }, []);

  useEffect(() => {
    const sessionUser = session?.user as { id?: string } | undefined;
    if (sessionUser?.id != undefined && sessionUser?.id != user?.id && !userLoading && !sessionLoading) {
      setUserLoading(true);
      fetchUser();
    }
    // Clear user state when session is gone (after signOut)
    if (!sessionUser?.id && !sessionLoading && user) {
      setUser(undefined);
      setWorkspace(undefined);
      setTranslations({});
    }
  }, [fetchUser, session?.user, user, userLoading, sessionLoading]);

  const fetchWorkspace = useCallback(
    (force = false) => {
      const workspaceId = router.query.workspaceId;
      if (!workspaceId) return;
      if (!force && workspaceId == workspace?.id) return;

      const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;
      setWorkspaceLoading(true);

      Promise.all([
        getWorkspace(wsId),
        getTranslations(wsId).catch((error) => {
          console.error('AuthBoundary -> fetchTranslations', error);
          return {} as TranslationsDto;
        }),
      ])
        .then(([workspaceData, translationsData]) => {
          setWorkspace(workspaceData);
          setTranslations(translationsData ?? {});
        })
        .catch((error) => {
          console.error('AuthBoundary -> fetchWorkspace', error);
          router.replace('/').then(() => {
            alertApiV1Error(error, 'Fehler beim Laden der Workspace');
          });
        })
        .finally(() => {
          setWorkspaceLoading(false);
        });
    },
    [router, workspace?.id],
  );

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const refreshWorkspace = useCallback(() => {
    fetchWorkspace(true);
  }, [fetchWorkspace]);

  const getTranslationOrNull = useCallback(
    (key: string, language: 'de') => {
      return translations?.[language]?.[key] ?? undefined;
    },
    [translations],
  );

  const getTranslation = useCallback(
    (key: string, language: 'de') => {
      return getTranslationOrNull(key, language) ?? key;
    },
    [getTranslationOrNull],
  );

  return (
    <>
      <UserContext.Provider
        value={{
          user: user,
          workspace: workspace,
          translations: translations,
          refreshWorkspace: refreshWorkspace,
          refreshUser: fetchUser,
          workspaceRefreshing: workspaceLoading,

          isUserPermitted: (role: Role) => {
            const userRole = workspace?.members.find((m) => m.userId == user?.id)?.role;
            if (!userRole) return false;

            switch (userRole) {
              case Role.USER:
                const userRoles: Role[] = [Role.USER];
                return userRoles.includes(role);
              case Role.MANAGER:
                const managerRoles: Role[] = [Role.MANAGER, Role.USER];
                return managerRoles.includes(role);
              case Role.ADMIN:
                const adminRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.USER];
                return adminRoles.includes(role);
              case Role.OWNER:
                const ownerRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.USER];
                return ownerRoles.includes(role);
              default:
                return false;
            }
          },
          updateUserSetting: (setting: string, value: string | null) => {
            fetch(`/api/users/settings`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                setting: setting,
                value: value,
              }),
            })
              .then(async (response) => {
                if (response.ok) {
                  fetchUser();
                } else {
                  const body = await response.json();
                  console.error('AuthBoundary -> updateUserSetting', response);
                  alertService.error(
                    body.error?.message ?? body.message ?? 'Fehler beim Aktualisieren der Nutzer-Einstellungen',
                    response.status,
                    response.statusText,
                  );
                }
              })
              .catch((error) => {
                console.error('AuthBoundary -> updateUserSetting', error);
                alertService.error('Es ist ein Fehler aufgetreten');
              });
          },
          getTranslation: getTranslation,
          getTranslationOrNull: getTranslationOrNull,
        }}
      >
        {userLoading ? (
          <PageCenter>
            <div className={'flex flex-col items-center justify-center gap-4'}>
              <Loading name={'Lade Nutzer...'} />
              <Button variant="outline" size="xs" className="border-error text-error hover:bg-error/10" onClick={cancelLogin}>
                Abbrechen
              </Button>
            </div>
          </PageCenter>
        ) : (
          <>{props.children}</>
        )}
      </UserContext.Provider>
    </>
  );
}
