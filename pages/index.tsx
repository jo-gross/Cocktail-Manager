import { signIn, signOut } from 'next-auth/react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Workspace } from '@prisma/client';
import { Loading } from '../components/Loading';
import Image from 'next/image';
import { FaArrowRight } from 'react-icons/fa';
import Link from 'next/link';
import { UserContext } from '../lib/context/UserContextProvider';
import { alertService } from '../lib/alertService';
import Head from 'next/head';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [joinWorkspaceId, setJoinWorkspaceId] = useState('');

  const userContext = useContext(UserContext);

  const fetchWorkspaces = useCallback(() => {
    if (!userContext.user) return;
    setWorkspacesLoading(true);
    fetch('/api/workspaces', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setWorkspaces(body.data);
        } else {
          console.log('index -> fetchWorkspaces', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
      .finally(() => setWorkspacesLoading(false));
  }, [userContext.user]);

  const createNewWorkspace = useCallback(() => {
    if (!userContext.user) return;
    fetch('/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newWorkspaceName }),
    })
      .then((results) => results.json())
      .then(() => setNewWorkspaceName(''))
      .then(() => fetchWorkspaces())
      .catch((err) => alertService.error(err.message));
  }, [userContext.user, newWorkspaceName, fetchWorkspaces]);

  const joinWorkspace = useCallback(() => {
    if (!userContext.user) return;
    fetch(`/api/workspaces/${joinWorkspaceId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Fehler beim beitreten');
        }
      })
      .then(() => setJoinWorkspaceId(''))
      .then(() => fetchWorkspaces())
      .catch((err) => alertService.error(err.message));
  }, [fetchWorkspaces, joinWorkspaceId, userContext.user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <>
      <Head>
        <title>The Cocktail-Manager</title>
      </Head>
      <div className={'grid md:grid-cols-3 grid-cols-1'}>
        <div className={'col-span-3 items-center'}>
          <div className={'flex flex-col items-center justify-center space-y-2'}>
            <Image
              src={'/images/The Cocktail Manager Logo.png'}
              alt="The Cocktail Manager"
              className={'pt-4 invert dark:invert-0'}
              height={211}
              width={247}
            />
            <h1 className={'text-center text-4xl font-bold'}>Cocktail-Manager</h1>
            <div className={'flex space-x-2 items-center'}>
              <>
                {userContext.user ? (
                  <>
                    <span>Hi {userContext.user.name}</span>
                    <button className={'btn btn-outline btn-sm'} onClick={() => signOut()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <button className={'btn btn-outline btn-sm'} onClick={() => signIn()}>
                    Sign in
                  </button>
                )}
              </>
            </div>
          </div>
        </div>
        {userContext.user && (
          <div className={'col-span-3 grid md:grid-cols-4 grid-cols-1 md:gap-4 gap-2 md:p-12 p-4'}>
            {workspacesLoading ? (
              <div className={'col-span-4'}>
                <Loading />
              </div>
            ) : (
              <>
                {workspaces.map((workspace) => (
                  <div key={`workspace-${workspace.id}`} className={'card h-40'}>
                    <div className={'card-body'}>
                      <div className={'text-center font-bold text-3xl'}>{workspace.name}</div>
                      <div className={'h-full'}></div>
                      <div className={'card-actions justify-center'}>
                        <Link href={'/workspaces/' + workspace.id}>
                          <span className={'btn w-3/4 btn-primary btn-outline'}>Öffnen</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                <div className={'card h-40'}>
                  <div className={'card-body flex flex-col h-full items-center justify-center space-y-2'}>
                    <div className={'input-group'}>
                      <input
                        className={'input input-bordered w-full'}
                        placeholder={'Neue Workspace erstellen'}
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                      />
                      <button
                        className={'btn btn-square btn-outline'}
                        disabled={newWorkspaceName.trim().length == 0}
                        onClick={createNewWorkspace}
                      >
                        <FaArrowRight />
                      </button>
                    </div>
                    <div className={'input-group'}>
                      <input
                        className={'input input-bordered w-full'}
                        placeholder={'Mit Code beitreten'}
                        value={joinWorkspaceId}
                        onChange={(event) => setJoinWorkspaceId(event.target.value)}
                      />
                      <button
                        className={'btn btn-square btn-outline'}
                        disabled={joinWorkspaceId.trim().length == 0}
                        onClick={joinWorkspace}
                      >
                        <FaArrowRight />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
