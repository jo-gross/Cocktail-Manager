import React, { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Role, User, UserSetting, WorkspaceSetting, WorkspaceUser } from '@prisma/client';
import { PageCenter } from '../PageCenter';
import { Loading } from '../../Loading';
import { UserContext } from '../../../lib/context/UserContextProvider';
import { alertService } from '../../../lib/alertService';
import { useRouter } from 'next/router';
import { WorkspaceFull } from '../../../models/WorkspaceFull';
import { WorkspaceSettingKey } from '.prisma/client';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AuthBoundary(props: AlertBoundaryProps) {
  const session = useSession();
  const [user, setUser] = useState<(User & { settings: UserSetting[] }) | undefined>();
  const [userLoading, setUserLoading] = useState<boolean>(false);

  const [workspace, setWorkspace] = useState<(WorkspaceFull & { users: WorkspaceUser[] }) | undefined>();
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(false);

  const router = useRouter();

  const cancelLogin = useCallback(async () => {
    await signOut();
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
          alertService.error(body.message ?? 'Fehler beim Laden des Nutzers', response.status, response.statusText);
          await signOut();
        }
      })
      .catch(async (error) => {
        console.error('AuthBoundary -> fetchUser', error);
        alertService.error('Fehler beim Laden des Nutzers');
        await signOut();
      })
      .finally(async () => {
        setUserLoading(false);
      });
  }, []);

  useEffect(() => {
    if (session.data?.user != undefined && session.data?.user?.email != user?.email && !userLoading) {
      setUserLoading(true);
      fetchUser();
    }
  }, [fetchUser, session.data?.user, user?.email, userLoading]);

  const fetchWorkspace = useCallback(() => {
    if (router.query.workspaceId && router.query.workspaceId != workspace?.id) {
      setWorkspaceLoading(true);
      fetch(`/api/workspaces/${router.query.workspaceId}`)
        .then(async (response) => {
          const body = await response.json();
          if (response.ok) {
            setWorkspace(body.data);
          } else {
            router.replace('/').then(() => {
              console.error('AuthBoundary -> fetchWorkspace', response);
              alertService.error(body.message ?? 'Fehler beim Laden der Workspace', response.status, response.statusText);
            });
          }
        })
        .catch((error) => {
          console.error('AuthBoundary -> fetchWorkspace', error);
          alertService.error('Fehler beim Laden der Workspace');
        })
        .finally(() => {
          setWorkspaceLoading(false);
        });
    }
  }, [router, workspace?.id]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const getTranslation = useCallback(
    (key: string, language: 'de') => {
      return (
        JSON.parse((workspace?.WorkspaceSetting as WorkspaceSetting[]).find((setting) => setting.setting == WorkspaceSettingKey.translations)?.value ?? '{}')[
          language
        ][key] ?? key
      );
    },
    [workspace],
  );

  return (
    <>
      <UserContext.Provider
        value={{
          user: user,
          workspace: workspace,
          refreshWorkspace: fetchWorkspace,
          refreshUser: fetchUser,
          workspaceRefreshing: workspaceLoading,

          isUserPermitted: (role: Role) => {
            const userRole = workspace?.users.find((u) => u.userId == user?.id)?.role;
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
                  alertService.error(body.message ?? 'Fehler beim Aktualisieren der Nutzer-Einstellungen', response.status, response.statusText);
                }
              })
              .catch((error) => {
                console.error('AuthBoundary -> updateUserSetting', error);
                alertService.error('Es ist ein Fehler aufgetreten');
              });
          },
          getTranslation: getTranslation,
        }}
      >
        {userLoading ? (
          <PageCenter>
            <div className={'flex flex-col items-center justify-center gap-4'}>
              <Loading name={'Lade Nutzer...'} />
              <button className={'btn btn-outline btn-error btn-xs'} onClick={cancelLogin}>
                Abbrechen
              </button>
            </div>
          </PageCenter>
        ) : (
          <>{props.children}</>
        )}
      </UserContext.Provider>
    </>
  );
}
