import React, { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Role, User, UserSetting, Workspace, WorkspaceUser } from '@prisma/client';
import { PageCenter } from '../PageCenter';
import { Loading } from '../../Loading';
import { UserContext } from '../../../lib/context/UserContextProvider';
import { alertService } from '../../../lib/alertService';
import { useRouter } from 'next/router';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AuthBoundary(props: AlertBoundaryProps) {
  const session = useSession();
  const [user, setUser] = useState<(User & { settings: UserSetting[] }) | undefined>();
  const [userLoading, setUserLoading] = useState<boolean>(false);

  const [workspace, setWorkspace] = useState<(Workspace & { users: WorkspaceUser[] }) | undefined>();
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
          console.log('AuthBoundary -> fetchUser', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => {
        alertService.error(err.message);
      })
      .finally(async () => {
        setUserLoading(false);
      });
  }, []);

  useEffect(() => {
    if (session.data?.user) {
      setUserLoading(true);
      fetchUser();
    }
    // to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchWorkspace = useCallback(() => {
    if (router.query.workspaceId && router.query.workspaceId != workspace?.id) {
      setWorkspaceLoading(true);
      fetch(`/api/workspaces/${router.query.workspaceId}`)
        .then(async (response) => {
          const body = await response.json();
          if (response.ok) {
            setWorkspace(body.data);
          } else {
            router.replace('/').then(() => alertService.error(body.message, response.status, response.statusText));
          }
        })
        .catch((err) => {
          alertService.error(err.message);
        })
        .finally(() => {
          setWorkspaceLoading(false);
        });
    }
  }, [router, workspace?.id]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return (
    <>
      <UserContext.Provider
        value={{
          user: user,
          workspace: workspace,
          refreshWorkspace: fetchWorkspace,
          refreshUser: fetchUser,
          workspaceRefreshing: workspaceLoading,
          isUserAdmin: () => {
            const userRole = workspace?.users.find((u) => u.userId == user?.id)?.role;
            if (!userRole) return false;
            return Array.from([Role.ADMIN, Role.OWNER]).some((item) => item == userRole);
          },
          isUserManager: () => {
            const userRole = workspace?.users.find((u) => u.userId == user?.id)?.role;
            if (!userRole) return false;
            return Array.from([Role.ADMIN, Role.MANAGER, Role.OWNER]).some((item) => item == userRole);
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
                  console.log('AuthBoundary -> updateUserSetting', response, body);
                  alertService.error(body.message, response.status, response.statusText);
                }
              })
              .catch((error) => {
                console.error(error);
                alertService.error(error.message);
              });
          },
        }}
      >
        {userLoading ? (
          <PageCenter>
            <div className={'flex flex-col justify-center items-center gap-4'}>
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
