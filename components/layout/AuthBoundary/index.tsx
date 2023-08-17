import React, { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { User, Workspace } from '@prisma/client';
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
  const [user, setUser] = useState<User | undefined>();
  const [userLoading, setUserLoading] = useState<boolean>(false);

  const [workspace, setWorkspace] = useState<Workspace | undefined>();

  const router = useRouter();

  const cancelLogin = useCallback(async () => {
    await signOut();
    setUserLoading(false);
  }, []);

  useEffect(() => {
    if (session.data?.user) {
      setUserLoading(true);
      fetch(`/api/users`)
        .then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            throw new Error('Error while loading user data');
          }
        })
        .then((res) => {
          setUser(res);
        })
        .catch((err) => {
          alertService.error(err.message);
        })
        .finally(async () => {
          setUserLoading(false);
        });
    }
  }, [session]);

  useEffect(() => {
    if (router.query.workspaceId && router.query.workspaceId != workspace?.id) {
      fetch(`/api/workspaces/${router.query.workspaceId}`)
        .then((res) => {
          if (res.ok) {
            return res.json();
          } else {
            router.replace('/');
            throw new Error('Error while loading workspace data');
          }
        })
        .then((res) => {
          setWorkspace(res);
        })
        .catch((err) => {
          alertService.error(err.message);
        });
    }
  }, [router, workspace?.id]);

  return (
    <>
      <UserContext.Provider value={{ user: user, workspace: workspace }}>
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
