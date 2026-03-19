import { authClient } from '@lib/auth-client';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Setting, Workspace, WorkspaceJoinRequest } from '@generated/prisma/client';
import { Loading } from '@components/Loading';
import Image from 'next/image';
import { FaArrowRight, FaGoogle, FaKey } from 'react-icons/fa';
import Link from 'next/link';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import Head from 'next/head';
import packageInfo from '../package.json';
import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { formatDateTime } from '@lib/DateUtils';
import { useRouter } from 'next/router';
import { MdOutlineCancel } from 'react-icons/md';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { NextPageWithPullToRefresh } from '../types/next';

interface AuthProvider {
  id: string;
  name: string;
  type: 'social' | 'oidc';
}

const WorkspacesPage: NextPageWithPullToRefresh = () => {
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
  const [workspaceCreationConfig, setWorkspaceCreationConfig] = useState<{ disabled: boolean; message: string | null } | null>(null);
  const [creatingDemoWorkspace, setCreatingDemoWorkspace] = useState(false);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);

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

  const fetchWorkspaceCreationConfig = useCallback(() => {
    fetch('/api/config/workspace-creation', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setWorkspaceCreationConfig(body.data);
        } else {
          console.error('WorkspacesOverview -> fetchWorkspaceCreationConfig', response);
          // Fallback: Wenn der Endpoint fehlschlägt, erlauben wir die Erstellung
          setWorkspaceCreationConfig({ disabled: false, message: null });
        }
      })
      .catch((error) => {
        console.error('WorkspacesOverview -> fetchWorkspaceCreationConfig', error);
        // Fallback: Wenn der Endpoint fehlschlägt, erlauben wir die Erstellung
        setWorkspaceCreationConfig({ disabled: false, message: null });
      });
  }, []);

  const fetchAuthProviders = useCallback(() => {
    fetch('/api/config/auth-providers', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setAuthProviders(body.data);
        }
      })
      .catch((error) => {
        console.error('WorkspacesOverview -> fetchAuthProviders', error);
      });
  }, []);

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

  const createDemoWorkspace = useCallback(async () => {
    setCreatingDemoWorkspace(true);
    try {
      const response = await fetch('/api/demo/create-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const body = await response.json();

      if (!response.ok) {
        alertService.error(body.message ?? 'Fehler beim Erstellen der Demo-Workspace', response.status, response.statusText);
        return;
      }

      // Sign in as demo user via custom demo-login endpoint
      const signInResponse = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: body.data.userId }),
      });

      if (signInResponse.ok) {
        // Redirect to workspace
        router.push(`/workspaces/${body.data.workspaceId}`);
      } else {
        alertService.error('Fehler beim Anmelden als Demo-User');
      }
    } catch (error) {
      console.error('WorkspacesOverview -> createDemoWorkspace', error);
      alertService.error('Fehler beim Erstellen der Demo-Workspace');
    } finally {
      setCreatingDemoWorkspace(false);
    }
  }, [router]);

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
    if (!userContext.user || changeLogFetch) return;

    const lastSeenVersion = userContext.user.settings?.find((s) => s.setting == Setting.lastSeenVersion)?.value;
    if (lastSeenVersion === packageInfo.version) return;

    setChangelogFetch(true);
    fetch('/user-changelog.json')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch changelog');
        return response.json();
      })
      .then((entries: Array<{ version: string; date: string; highlights: string[] }>) => {
        const currentEntry = entries.find((e) => e.version === packageInfo.version);
        const recentEntries = entries.slice(0, 3);

        modalContext.openModal(
          <div className={'flex flex-col gap-4'}>
            <div className={'w-full text-center text-2xl font-bold'}>Neue Version ({packageInfo.version})</div>
            {currentEntry && (
              <div className={'flex flex-col gap-2'}>
                <ul className={'list-disc space-y-1 pl-5'}>
                  {currentEntry.highlights.map((highlight, i) => (
                    <li key={i}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            {recentEntries.length > 1 && (
              <details className={'mt-2'}>
                <summary className={'cursor-pointer text-sm text-base-content/60'}>Vorherige Versionen</summary>
                <div className={'mt-2 flex flex-col gap-3'}>
                  {recentEntries
                    .filter((e) => e.version !== packageInfo.version)
                    .map((entry) => (
                      <div key={entry.version} className={'flex flex-col gap-1'}>
                        <div className={'text-sm font-semibold'}>
                          v{entry.version} ({entry.date})
                        </div>
                        <ul className={'list-disc space-y-0.5 pl-5 text-sm'}>
                          {entry.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </details>
            )}
            <div className={'w-full text-center text-sm italic'}>
              <Link href={'https://github.com/jo-gross/Cocktail-Manager/releases'} className={'link'} target={'_blank'}>
                Alle Änderungen ansehen
              </Link>
            </div>
          </div>,
        );

        userContext.updateUserSetting(Setting.lastSeenVersion, packageInfo.version);
      })
      .catch((error) => {
        console.error('Failed to load user changelog', error);
      });
  }, [changeLogFetch, modalContext, userContext, userContext.user]);

  useEffect(() => {
    fetchWorkspaces();
    fetchOpenWorkspaceJoinRequest();
    fetchWorkspaceCreationConfig();
    fetchAuthProviders();
  }, [fetchOpenWorkspaceJoinRequest, fetchWorkspaces, fetchWorkspaceCreationConfig, fetchAuthProviders]);

  WorkspacesPage.pullToRefresh = () => {
    fetchWorkspaces();
    fetchOpenWorkspaceJoinRequest();
    fetchWorkspaceCreationConfig();
    fetchAuthProviders();
  };

  const handleSignIn = (providerId: string, providerType: 'social' | 'oidc') => {
    if (providerType === 'social') {
      authClient.signIn.social({ provider: providerId as 'google' });
    } else {
      // For generic OAuth/OIDC providers
      authClient.signIn.oauth2({ providerId });
    }
  };

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
              {` ${process.env.DEPLOYMENT == 'development' ? '(DEV)' : ''} - by `}
              <Link className={'link'} target={'_blank'} href={'https://github.com/jo-gross'}>
                Johannes Groß
              </Link>
            </div>
            <div className={'flex items-center space-x-2'}>
              <>
                {userContext.user ? (
                  <>
                    <span>Hi {userContext.user.name}</span>
                    <button className={'btn btn-outline btn-sm'} onClick={() => authClient.signOut()}>
                      Sign out
                    </button>
                  </>
                ) : process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? (
                  <button className={'btn btn-primary btn-sm'} onClick={createDemoWorkspace} disabled={creatingDemoWorkspace}>
                    {creatingDemoWorkspace ? (
                      <>
                        <span className={'loading loading-spinner'} />
                        Demo wird erstellt...
                      </>
                    ) : (
                      'Demo starten'
                    )}
                  </button>
                ) : authProviders.length > 0 ? (
                  <div className={'flex flex-wrap justify-center gap-2'}>
                    {authProviders.map((provider) => (
                      <button key={provider.id} className={'btn btn-outline btn-sm gap-2'} onClick={() => handleSignIn(provider.id, provider.type)}>
                        {provider.id === 'google' ? <FaGoogle /> : <FaKey />}
                        {provider.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={'text-sm text-base-content/60'}>Keine Anmeldung konfiguriert</span>
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
                        <div className={'text-center font-thin'}>Datum der Anfrage: {formatDateTime(new Date(workspaceJoinRequest.date))}</div>
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
            {workspaceCreationConfig && (!workspaceCreationConfig.disabled || workspaceCreationConfig.message) ? (
              <>
                <div className={'divider col-span-full'}>Workspace hinzufügen</div>
                {workspaceCreationConfig.disabled && workspaceCreationConfig.message ? (
                  <div className={'card'}>
                    <div className={'card-body flex h-full flex-col items-center justify-center space-y-2'}>
                      <div className={'card-title'}>Workspace erstellen</div>
                      <div
                        className={'text-center'}
                        dangerouslySetInnerHTML={{
                          __html: workspaceCreationConfig.message.replaceAll('<a', '<a class="link"'),
                        }}
                      />
                    </div>
                  </div>
                ) : (
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
                )}
              </>
            ) : null}
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
};

export default WorkspacesPage;
