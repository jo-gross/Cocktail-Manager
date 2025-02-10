import { signIn, signOut } from 'next-auth/react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Setting, Workspace, WorkspaceJoinRequest } from '@prisma/client';
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
import '../lib/DateUtils';
import { useRouter } from 'next/router';
import { MdOutlineCancel } from 'react-icons/md';
import { DeleteConfirmationModal } from '../components/modals/DeleteConfirmationModal';

export default function WorkspacesPage() {
  const themeContext = useContext(ThemeContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();
  const { code } = router.query;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  const [openWorkspaceJoinRequestLoading, setOpenWorkspaceJoinRequestLoading] = useState(false);
  const [openWorkspaceJoinRequest, setOpenWorkspaceJoinRequest] = useState<(WorkspaceJoinRequest & { workspace: Workspace })[]>([]);
  const [joinRequestCanceling, setJoinRequestCanceling] = useState<Record<string, boolean>>({});

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

  const fetchOpenWorkspaceJoinRequest = useCallback(() => {
    if (!userContext.user) return;
    setOpenWorkspaceJoinRequestLoading(true);
    fetch('/api/users/workspace-requests', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setOpenWorkspaceJoinRequest(body.data);
        } else {
          console.error('WorkspacesOverview -> fetchOpenWorkspaceJoinRequest', response);
          alertService.error(body.message ?? 'Fehler beim Laden der offenen Beitrittsanfragen', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('WorkspacesOverview -> fetchOpenWorkspaceJoinRequest', error);
        alertService.error('Fehler beim Laden der offenen Beitrittsanfragen');
      })
      .finally(() => setOpenWorkspaceJoinRequestLoading(false));
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

  const joinWorkspace = useCallback(
    (code: string) => {
      if (!userContext.user) return;
      if (code.trim().length == 0) return;
      setJoiningWorkspace(true);
      fetch(
        `/api/workspaces/join?` +
          new URLSearchParams({
            code: code,
          }),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
        .then(async (response) => {
          if (!response.ok) {
            try {
              if (response.body) {
                const body = await response.json();
                if (body?.data?.key == 'JOIN_ALREADY_REQUESTED') {
                  alertService.info('Du hast bereits eine Beitrittsanfrage für diesen Workspace gestellt');
                } else if (body?.data?.key == 'ALREADY_IN_WORKSPACE') {
                  alertService.info('Du bist bereits in dieser Workspace');
                } else {
                  alertService.error('Mit diesem Code konntest du keiner Workspace beitreten, bitte überprüfe den Code und versuche es erneut');
                }
              } else {
                alertService.error('Mit diesem Code konntest du keiner Workspace beitreten, bitte überprüfe den Code und versuche es erneut');
              }
            } catch (error) {
              console.error('WorkspacesOverview -> joinWorkspace', error);
              alertService.error('Fehler beim Beitreten der Workspace');
            }
          } else {
            alertService.success('Beitrittsanfrage gesendet, warte auf Annahme');
          }
        })
        .then(async () => {
          setJoinWorkspaceId('');
          if (router.query.code) await router.replace('/');
        })
        .then(() => {
          fetchWorkspaces();
          fetchOpenWorkspaceJoinRequest();
        })
        .catch((error) => {
          console.error('WorkspacesOverview -> joinWorkspace', error);
          alertService.error('Fehler beim Beitreten');
        })
        .finally(() => setJoiningWorkspace(false));
    },
    [fetchOpenWorkspaceJoinRequest, fetchWorkspaces, router, userContext.user],
  );

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
    fetchOpenWorkspaceJoinRequest();
  }, [fetchOpenWorkspaceJoinRequest, fetchWorkspaces]);

  useEffect(() => {
    if (code) {
      modalContext.openModal(
        <div className={'flex flex-col gap-2'}>
          <div className={'text-2xl font-bold'}>Mit Code beitreten</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinWorkspace(code as string);
              alertService.info('aSD');
              modalContext.closeAllModals();
            }}
          >
            <div className={'form-control'}>
              <label className={'label'}>
                <div className={'label-text'}>Beitrittscode</div>
              </label>
              <div className={'join w-full'}>
                <input
                  className={'input join-item input-bordered w-full'}
                  placeholder={'Beitrittscode'}
                  value={code as string}
                  onChange={(event) => setJoinWorkspaceId(event.target.value)}
                />
                <button
                  className={`btn btn-outline join-item w-fit min-w-12`}
                  disabled={(code as string).trim().length == 0 || joiningWorkspace}
                  type={'submit'}
                >
                  {joiningWorkspace ? <span className={'loading loading-spinner'} /> : <></>}
                  <FaArrowRight />
                </button>
              </div>
            </div>
          </form>
        </div>,
      );
    }
  }, []);

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
            <h1 className={'text-center text-4xl font-bold'}>The Cocktail-Manager</h1>
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
            <div className={'divider col-span-full'}>Meine Workspaces</div>
            {workspacesLoading ? (
              <div className={'col-span-full'}>
                <Loading />
              </div>
            ) : workspaces.length == 0 ? (
              <div className={'col-span-full text-center'}>Keine Workspaces</div>
            ) : (
              workspaces.map((workspace) => (
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
              ))
            )}

            {(openWorkspaceJoinRequest.length > 0 || openWorkspaceJoinRequestLoading) && (
              <>
                <div className={'divider col-span-full'}>Beitrittsanfragen</div>
                {openWorkspaceJoinRequestLoading ? (
                  <div className={'col-span-full'}>
                    <Loading />
                  </div>
                ) : (
                  openWorkspaceJoinRequest.map((workspaceJoinRequest) => (
                    <div key={`join-request-${workspaceJoinRequest.workspace.id}`} className={'card'}>
                      <div className={'card-body'}>
                        <div className={'text-center text-3xl font-bold'}>
                          <span className={'italic'}>Angefragt: </span>
                          {workspaceJoinRequest.workspace.name}
                        </div>
                        <div className={'text-center font-thin'}>Datum der Anfrage: {new Date(workspaceJoinRequest.date).toFormatDateTimeString()}</div>
                        <div className={'h-full'}></div>
                        <div className={'card-actions justify-center'}>
                          <button type={'button'} className={'btn btn-outline btn-primary'} disabled={true}>
                            Warte auf Annahme
                          </button>
                          <button
                            type={'button'}
                            className={'btn btn-square btn-outline btn-error'}
                            onClick={() =>
                              modalContext.openModal(
                                <DeleteConfirmationModal
                                  onApprove={async () => {
                                    setJoinRequestCanceling({ ...joinRequestCanceling, [workspaceJoinRequest.workspaceId]: true });
                                    fetch(`/api/workspaces/${workspaceJoinRequest.workspaceId}/join-requests`, {
                                      method: 'DELETE',
                                    })
                                      .then((response) => {
                                        if (response.ok) {
                                          alertService.success('Beitrittsanfrage abgebrochen');
                                        } else {
                                          alertService.error('Fehler beim Abbrechen der Beitrittsanfrage');
                                        }
                                      })
                                      .then(() => fetchOpenWorkspaceJoinRequest())
                                      .catch((error) => {
                                        console.error('WorkspacesOverview -> openWorkspaceJoinRequest -> cancel', error);
                                        alertService.error('Fehler beim Abbrechen der Beitrittsanfrage');
                                      })
                                      .finally(() => {
                                        setJoinRequestCanceling({ ...joinRequestCanceling, [workspaceJoinRequest.workspaceId]: false });
                                      });
                                  }}
                                  spelling={'ABORT'}
                                  entityName={`den Beitritt zu '${workspaceJoinRequest.workspace.name}'`}
                                />,
                              )
                            }
                            disabled={joinRequestCanceling[workspaceJoinRequest.workspaceId]}
                          >
                            <MdOutlineCancel />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
            <div className={'divider col-span-full'}>Workspace hinzufügen</div>
            <div className={'card'}>
              <div className={'card-body flex h-full flex-col items-center justify-center space-y-2'}>
                <div className={'card-title'}>Workspace erstellen</div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createNewWorkspace();
                  }}
                >
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <div className={'label-text'}>Name der Workspace</div>
                    </label>
                    <div className={'join w-full'}>
                      <input
                        className={'input join-item input-bordered w-full'}
                        placeholder={'Name der Workspace'}
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                      />
                      <button
                        className={`btn btn-outline join-item w-fit min-w-12`}
                        disabled={newWorkspaceName.trim().length == 0 || creatingWorkspace}
                        type={'submit'}
                      >
                        {creatingWorkspace ? <span className={'loading loading-spinner'} /> : <></>}
                        <FaArrowRight />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
            <div className={'card'}>
              <div className={'card-body flex flex-col items-center justify-center gap-2'}>
                <div className={'card-title'}>Workspace beitreten</div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    joinWorkspace(joinWorkspaceId);
                  }}
                >
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <div className={'label-text'}>Beitrittscode</div>
                    </label>
                    <div className={'join w-full'}>
                      <input
                        className={'input join-item input-bordered w-full'}
                        placeholder={'Beitrittscode'}
                        value={joinWorkspaceId}
                        onChange={(event) => setJoinWorkspaceId(event.target.value)}
                      />
                      <button
                        className={`btn btn-outline join-item w-fit min-w-12`}
                        disabled={joinWorkspaceId.trim().length == 0 || joiningWorkspace}
                        type={'submit'}
                      >
                        {joiningWorkspace ? <span className={'loading loading-spinner'} /> : <></>}
                        <FaArrowRight />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
