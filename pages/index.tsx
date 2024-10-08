import { signIn, signOut } from 'next-auth/react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Setting, Workspace } from '@prisma/client';
import { Loading } from '../components/Loading';
import Image from 'next/image';
import { FaArrowRight } from 'react-icons/fa';
import Link from 'next/link';
import { UserContext } from '../lib/context/UserContextProvider';
import { alertService } from '../lib/alertService';
import Head from 'next/head';
import packageInfo from '../package.json';
import { ThemeContext } from '../lib/context/ThemeContextProvider';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { marked } from 'marked';

export default function WorkspacesPage() {
  const themeContext = useContext(ThemeContext);
  const modalContext = useContext(ModalContext);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [joinWorkspaceId, setJoinWorkspaceId] = useState('');

  const userContext = useContext(UserContext);

  const [joiningWorkspace, setJoiningWorkspace] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const [changeLogFetch, setChangelogFetch] = useState(false);

  const fetchWorkspaces = useCallback(() => {
    if (!userContext.user) return;
    setWorkspacesLoading(true);
    fetch('/api/workspaces', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setWorkspaces(body.data);
        } else {
          console.error('WorkspacesOverview -> fetchWorkspaces', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Workspaces', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('WorkspacesOverview -> fetchWorkspaces', error);
        alertService.error('Fehler beim Laden der Workspaces');
      })
      .finally(() => setWorkspacesLoading(false));
  }, [userContext.user]);

  const createNewWorkspace = useCallback(() => {
    if (!userContext.user) return;
    setCreatingWorkspace(true);
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
      .catch((error) => {
        console.error('WorkspacesOverview -> createNewWorkspace', error);
        alertService.error('Fehler beim Erstellen der Workspace');
      })
      .finally(() => setCreatingWorkspace(false));
  }, [userContext.user, newWorkspaceName, fetchWorkspaces]);

  const joinWorkspace = useCallback(() => {
    if (!userContext.user) return;
    setJoiningWorkspace(true);
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
      .catch((error) => {
        console.error('WorkspacesOverview -> joinWorkspace', error);
        alertService.error('Fehler beim Beitreten');
      })
      .finally(() => setJoiningWorkspace(false));
  }, [fetchWorkspaces, joinWorkspaceId, userContext.user]);

  useEffect(() => {
    if (userContext.user && (document.getElementById('changelog-modal')?.innerHTML == '' || !document.getElementById('changelog-modal'))) {
      if (userContext.user.settings?.find((userSetting) => userSetting.setting == Setting.lastSeenVersion)?.value != packageInfo.version && !changeLogFetch) {
        setChangelogFetch(true);
        fetch('https://raw.githubusercontent.com/jo-gross/Cocktail-Manager/main/docs/CHANGELOG.md')
          .then((response) => {
            if (response.ok) {
              return response.text();
            }
          })
          .then((text) => {
            if (text) {
              return marked(text);
            }
          })
          .then((innerHtml) => {
            if (innerHtml) {
              innerHtml = innerHtml.replaceAll('<h1', '<div class="text-2xl font-bold" ');
              innerHtml = innerHtml.replaceAll('/h1>', '/div>');
              innerHtml = innerHtml.replaceAll('<h2', '<div class="text-xl font-bold" ');
              innerHtml = innerHtml.replaceAll('/h2>', '/div>');
              innerHtml = innerHtml.replaceAll('<h3', '<div class="text-lg font-bold" ');
              innerHtml = innerHtml.replaceAll('/h3>', '/div>');
              innerHtml = innerHtml.replaceAll('<ul>', '<ul class="list-disc pl-4">');
              innerHtml = innerHtml.replaceAll('<a', '<a class="link"');

              modalContext.openModal(
                <div className={'flex flex-col'}>
                  <div className={'w-full text-center text-2xl font-bold'}>Neue Version ({packageInfo.version})</div>
                  <div className={'w-full text-center italic'}>
                    <Link href={'https://github.com/jo-gross/Cocktail-Manager/releases'} className={'link'} target={'_blank'}>
                      Changelog ansehen
                    </Link>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: innerHtml }} />{' '}
                </div>,
              );

              userContext.updateUserSetting(Setting.lastSeenVersion, packageInfo.version);
            }
          })
          .catch((error) => {
            console.error('WorkspacesOverview -> useEffect -> fetch', error);
          });
      }
    }
  }, [changeLogFetch, modalContext, userContext, userContext.user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <>
      <Head>
        <title>The Cocktail-Manager</title>
      </Head>
      <div className={'grid grid-cols-1 md:grid-cols-3'}>
        <div className={'col-span-3 items-center'}>
          <div className={'flex flex-col items-center justify-center space-y-2'}>
            <Image
              src={'/images/The Cocktail Manager Logo.png'}
              alt="The Cocktail Manager"
              className={`pt-4 ${themeContext.theme == 'light' ? 'invert' : themeContext.theme == 'auto' ? 'invert dark:invert-0' : ''}`}
              height={211}
              width={247}
            />
            <h1 className={'text-center text-4xl font-bold'}>Cocktail-Manager</h1>
            <div>
              <Link href={'https://github.com/jo-gross/Cocktail-Manager/'} target={'_blank'} className={'link'}>
                v{packageInfo.version}
              </Link>
              {` ${process.env.NODE_ENV == 'development' ? '(DEV)' : ''} - by `}
              <Link className={'link'} target={'_blank'} href={'https://github.com/jo-gross'}>
                Johannes Groß
              </Link>
            </div>
            <div className={'flex items-center space-x-2'}>
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
          <div className={'col-span-3 grid grid-cols-1 gap-2 p-4 md:gap-4 md:p-12 lg:grid-cols-4'}>
            {workspacesLoading ? (
              <div className={'col-span-4'}>
                <Loading />
              </div>
            ) : (
              <>
                {workspaces.map((workspace) => (
                  <div key={`workspace-${workspace.id}`} className={'card h-40'}>
                    <div className={'card-body'}>
                      <div className={'text-center text-3xl font-bold'}>{workspace.name}</div>
                      <div className={'h-full'}></div>
                      <div className={'card-actions justify-center'}>
                        <Link href={'/workspaces/' + workspace.id} replace={true}>
                          <span className={'btn btn-outline btn-primary'}>Öffnen</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                <div className={'card h-40'}>
                  <div className={'card-body flex h-full flex-col items-center justify-center space-y-2'}>
                    <div className={'join w-full'}>
                      <input
                        className={'input join-item input-bordered w-full'}
                        placeholder={'Neue Workspace erstellen'}
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                      />
                      <button
                        className={`btn ${creatingWorkspace ? '' : 'btn-square'} btn-outline join-item`}
                        disabled={newWorkspaceName.trim().length == 0 || creatingWorkspace}
                        onClick={createNewWorkspace}
                      >
                        {creatingWorkspace ? <span className={'loading loading-spinner'} /> : <></>}
                        <FaArrowRight />
                      </button>
                    </div>
                    <div className={'join w-full'}>
                      <input
                        className={'input join-item input-bordered w-full'}
                        placeholder={'Mit Code beitreten'}
                        value={joinWorkspaceId}
                        onChange={(event) => setJoinWorkspaceId(event.target.value)}
                      />
                      <button
                        className={`btn ${joiningWorkspace ? '' : 'btn-square'} btn-outline join-item`}
                        disabled={joinWorkspaceId.trim().length == 0 || joiningWorkspace}
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
