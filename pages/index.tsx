import { authClient } from '@lib/auth-client';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import ThemeChanger from '@components/ThemeChanger';
import LanguageChanger from '@components/LanguageChanger';
import { NextPageWithPullToRefresh } from '../types/next';
import { createWorkspace, fetchWorkspacesSafe, type WorkspaceListItem } from '@lib/network/workspaces';
import { withdrawOwnJoinRequest } from '@lib/network/workspaceUsers';
import { alertApiV1Error } from '@lib/network/apiV1';
import {
  Button,
  ButtonGroup,
  Card,
  CardActions,
  CardBody,
  CardTitle,
  Divider,
  FormControl,
  Input,
  Label,
  LabelText,
  Loading as UiLoading,
} from '@components/ui';

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

  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspacesFetched, setWorkspacesFetched] = useState(false);

  const [openWorkspaceJoinRequestLoading, setOpenWorkspaceJoinRequestLoading] = useState(false);
  const [openWorkspaceJoinRequest, setOpenWorkspaceJoinRequest] = useState<(WorkspaceJoinRequest & { workspace: Workspace })[]>([]);
  const [joinRequestCanceling, setJoinRequestCanceling] = useState<Record<string, boolean>>({});

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [joinWorkspaceId, setJoinWorkspaceId] = useState('');

  const userContext = useContext(UserContext);
  const { t } = useTranslation(['auth', 'common', 'nav']);

  const [joiningWorkspace, setJoiningWorkspace] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const [changeLogFetch, setChangelogFetch] = useState(false);
  const [workspaceCreationConfig, setWorkspaceCreationConfig] = useState<{ disabled: boolean; message: string | null } | null>(null);
  const [creatingDemoWorkspace, setCreatingDemoWorkspace] = useState(false);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);

  const fetchWorkspaces = useCallback(() => {
    if (!userContext.user) return;
    fetchWorkspacesSafe(
      setWorkspaces,
      (loading) => {
        setWorkspacesLoading(loading);
        if (!loading) setWorkspacesFetched(true);
      },
      t('auth:error.loadWorkspaces'),
    );
  }, [userContext.user, t]);

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
          alertService.error(body.error?.message ?? body.message ?? t('auth:error.loadJoinRequests'), response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('WorkspacesOverview -> fetchOpenWorkspaceJoinRequest', error);
        alertService.error(t('auth:error.loadJoinRequests'));
      })
      .finally(() => setOpenWorkspaceJoinRequestLoading(false));
  }, [userContext.user, t]);

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
    createWorkspace({ name: newWorkspaceName })
      .then(() => setNewWorkspaceName(''))
      .then(() => fetchWorkspaces())
      .catch((error) => {
        console.error('WorkspacesOverview -> createNewWorkspace', error);
        alertApiV1Error(error, t('auth:error.createWorkspace'));
      })
      .finally(() => setCreatingWorkspace(false));
  }, [userContext.user, newWorkspaceName, fetchWorkspaces, t]);

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
        alertService.error(body.error?.message ?? body.message ?? t('auth:error.createDemoWorkspace'), response.status, response.statusText);
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
        alertService.error(t('auth:error.demoLogin'));
      }
    } catch (error) {
      console.error('WorkspacesOverview -> createDemoWorkspace', error);
      alertService.error(t('auth:error.createDemoWorkspace'));
    } finally {
      setCreatingDemoWorkspace(false);
    }
  }, [router, t]);

  const joinWorkspace = useCallback(
    (code: string) => {
      if (!userContext.user) return;
      if (code.trim().length == 0) return;
      setJoiningWorkspace(true);
      fetch(
        `/api/v1/workspaces/join?` +
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
                  alertService.info(t('auth:alert.alreadyRequested'));
                } else if (body?.data?.key == 'ALREADY_IN_WORKSPACE') {
                  alertService.info(t('auth:alert.alreadyMember'));
                } else {
                  alertService.error(t('auth:alert.invalidCode'));
                }
              } else {
                alertService.error(t('auth:alert.invalidCode'));
              }
            } catch (error) {
              console.error('WorkspacesOverview -> joinWorkspace', error);
              alertService.error(t('auth:error.joinWorkspace'));
            }
          } else {
            alertService.success(t('auth:joinRequestSent'));
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
          alertService.error(t('auth:error.join'));
        })
        .finally(() => setJoiningWorkspace(false));
    },
    [fetchOpenWorkspaceJoinRequest, fetchWorkspaces, router, userContext.user, t],
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
            <div className={'w-full text-center text-2xl font-bold'}>{t('auth:newVersion', { version: packageInfo.version })}</div>
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
                <summary className={'cursor-pointer text-sm text-base-content/60'}>{t('auth:previousVersions')}</summary>
                <div className={'mt-2 flex flex-col gap-3'}>
                  {recentEntries
                    .filter((e) => e.version !== packageInfo.version)
                    .map((entry) => (
                      <div key={entry.version} className={'flex flex-col gap-1'}>
                        <div className={'text-sm font-semibold'}>{t('common:versionDate', { version: entry.version, date: entry.date })}</div>
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
                {t('auth:viewAllChanges')}
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
    if (!userContext.user) {
      setWorkspaces([]);
      setWorkspacesFetched(false);
      return;
    }
    fetchWorkspaces();
    fetchOpenWorkspaceJoinRequest();
  }, [userContext.user?.id, fetchWorkspaces, fetchOpenWorkspaceJoinRequest]);

  useEffect(() => {
    fetchWorkspaceCreationConfig();
    fetchAuthProviders();
  }, [fetchWorkspaceCreationConfig, fetchAuthProviders]);

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
      authClient.signIn.social({ provider: providerId });
    }
  };

  useEffect(() => {
    if (code) {
      modalContext.openModal(
        <div className={'flex flex-col gap-2'}>
          <div className={'text-2xl font-bold'}>{t('auth:joinWithCode')}</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinWorkspace(code as string);
              modalContext.closeAllModals();
            }}
          >
            <FormControl>
              <Label>
                <LabelText>{t('auth:joinCode')}</LabelText>
              </Label>
              <ButtonGroup className="w-full">
                <Input
                  joinItem
                  className="w-full"
                  placeholder={t('auth:joinCode')}
                  value={code as string}
                  onChange={(event) => setJoinWorkspaceId(event.target.value)}
                />
                <Button
                  variant="outline"
                  joinItem
                  className="w-fit min-w-12"
                  disabled={(code as string).trim().length == 0 || joiningWorkspace}
                  type={'submit'}
                >
                  {joiningWorkspace ? <UiLoading size="sm" /> : <FaArrowRight />}
                </Button>
              </ButtonGroup>
            </FormControl>
          </form>
        </div>,
      );
    }
  }, []);

  const logoClassName = themeContext.theme == 'light' ? 'invert' : themeContext.theme == 'auto' ? 'invert dark:invert-0' : '';

  const versionLine = (
    <div className="text-center text-sm text-base-content/70">
      <Link href={'https://github.com/jo-gross/Cocktail-Manager/'} target={'_blank'} className={'link'}>
        {t('common:versionLine', {
          version: packageInfo.version,
          env: process.env.DEPLOYMENT == 'development' ? t('common:devEnvSuffix') : '',
        })}
      </Link>
      {' - '}
      {t('common:byAuthor')}{' '}
      <Link className={'link'} target={'_blank'} href={'https://github.com/jo-gross'}>
        {t('common:authorName')}
      </Link>
    </div>
  );

  return (
    <>
      <Head>
        <title>{t('common:appName')}</title>
      </Head>
      <div className="relative">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <LanguageChanger size="sm" />
          <ThemeChanger size="sm" />
        </div>
        {!userContext.user ? (
          <div className="flex min-h-dvh flex-col items-center justify-center p-4">
            <Card variant="elevated" className="w-full max-w-md">
              <CardBody className="flex flex-col items-center gap-4">
                <Image src={'/images/The Cocktail Manager Logo.png'} alt="The Cocktail Manager" className={logoClassName} height={180} width={211} />
                <h1 className="text-center text-3xl font-bold">{t('common:appName')}</h1>
                {versionLine}
                <Divider className="w-full">{t('auth:login')}</Divider>
                {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? (
                  <Button variant="primary" className="w-full" onClick={createDemoWorkspace} disabled={creatingDemoWorkspace}>
                    {creatingDemoWorkspace ? (
                      <>
                        <UiLoading size="sm" />
                        {t('auth:demoCreating')}
                      </>
                    ) : (
                      t('auth:demoStart')
                    )}
                  </Button>
                ) : authProviders.length > 0 ? (
                  <div className="flex w-full flex-col gap-2">
                    {authProviders.map((provider) => (
                      <Button key={provider.id} variant="outline" className="w-full gap-2" onClick={() => handleSignIn(provider.id, provider.type)}>
                        {provider.id === 'google' ? <FaGoogle /> : <FaKey />}
                        {provider.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-base-content/60">{t('auth:noAuthConfigured')}</span>
                )}
              </CardBody>
            </Card>
          </div>
        ) : (
          <div className={'grid grid-cols-1 md:grid-cols-3'}>
            <div className={'col-span-3 items-center'}>
              <div className={'flex flex-col items-center justify-center space-y-2 pt-4'}>
                <Image src={'/images/The Cocktail Manager Logo.png'} alt="The Cocktail Manager" className={logoClassName} height={211} width={247} />
                <h1 className={'text-center text-4xl font-bold'}>{t('common:appName')}</h1>
                {versionLine}
                <div className={'flex items-center space-x-2'}>
                  <span>{t('auth:hi', { name: userContext.user.name })}</span>
                  <Button variant="outline" size="sm" onClick={() => authClient.signOut()}>
                    {t('auth:logout')}
                  </Button>
                </div>
              </div>
            </div>
            <div className={'col-span-3 grid grid-cols-1 gap-2 p-4 md:gap-4 md:p-12 lg:grid-cols-4'}>
              <Divider className="col-span-full">{t('nav:myWorkspaces')}</Divider>
              {userContext.user && (workspacesLoading || !workspacesFetched) ? (
                <div className={'col-span-full'}>
                  <Loading />
                </div>
              ) : workspaces.length == 0 ? (
                <div className={'col-span-full text-center'}>{t('auth:noWorkspaces')}</div>
              ) : (
                workspaces.map((workspace) => (
                  <Card key={`workspace-${workspace.id}`} className="h-40">
                    <CardBody>
                      <div className={'text-center text-3xl font-bold'}>{workspace.name}</div>
                      <div className={'h-full'}></div>
                      <CardActions className="justify-center">
                        <Link href={'/workspaces/' + workspace.id} replace={true}>
                          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                            {t('auth:open')}
                          </Button>
                        </Link>
                      </CardActions>
                    </CardBody>
                  </Card>
                ))
              )}

              {(openWorkspaceJoinRequest.length > 0 || openWorkspaceJoinRequestLoading) && (
                <>
                  <Divider className="col-span-full">{t('auth:joinRequests')}</Divider>
                  {openWorkspaceJoinRequestLoading ? (
                    <div className={'col-span-full'}>
                      <Loading />
                    </div>
                  ) : (
                    openWorkspaceJoinRequest.map((workspaceJoinRequest) => (
                      <Card key={`join-request-${workspaceJoinRequest.workspace.id}`}>
                        <CardBody>
                          <div className={'text-center text-3xl font-bold'}>
                            <span className={'italic'}>{t('auth:requestedAt')} </span>
                            {workspaceJoinRequest.workspace.name}
                          </div>
                          <div className={'text-center font-thin'}>
                            {t('auth:joinRequestDate')} {formatDateTime(new Date(workspaceJoinRequest.date))}
                          </div>
                          <div className={'h-full'}></div>
                          <CardActions className="justify-center">
                            <Button type="button" variant="outline" className="border-primary text-primary hover:bg-primary/10" disabled>
                              {t('auth:waitingAcceptance')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              shape="square"
                              className="border-error text-error hover:bg-error/10"
                              onClick={() =>
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    onApprove={async () => {
                                      setJoinRequestCanceling({ ...joinRequestCanceling, [workspaceJoinRequest.workspaceId]: true });
                                      withdrawOwnJoinRequest(workspaceJoinRequest.workspaceId)
                                        .then(() => {
                                          alertService.success(t('auth:joinRequestCancelled'));
                                          fetchOpenWorkspaceJoinRequest();
                                        })
                                        .catch((error) => {
                                          console.error('WorkspacesOverview -> openWorkspaceJoinRequest -> cancel', error);
                                          alertApiV1Error(error, t('auth:error.cancelJoinRequest'));
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
                            </Button>
                          </CardActions>
                        </CardBody>
                      </Card>
                    ))
                  )}
                </>
              )}
              {workspaceCreationConfig && (!workspaceCreationConfig.disabled || workspaceCreationConfig.message) ? (
                <>
                  <Divider className="col-span-full">{t('auth:addWorkspace')}</Divider>
                  {workspaceCreationConfig.disabled && workspaceCreationConfig.message ? (
                    <Card>
                      <CardBody className="flex h-full flex-col items-center justify-center space-y-2">
                        <CardTitle>{t('auth:createWorkspace')}</CardTitle>
                        <div
                          className={'text-center'}
                          dangerouslySetInnerHTML={{
                            __html: workspaceCreationConfig.message.replaceAll('<a', '<a class="link"'),
                          }}
                        />
                      </CardBody>
                    </Card>
                  ) : (
                    <Card>
                      <CardBody className="flex h-full flex-col items-center justify-center space-y-2">
                        <CardTitle>{t('auth:createWorkspace')}</CardTitle>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            createNewWorkspace();
                          }}
                        >
                          <FormControl>
                            <Label>
                              <LabelText>{t('auth:workspaceName')}</LabelText>
                            </Label>
                            <ButtonGroup className="w-full">
                              <Input
                                joinItem
                                className="w-full"
                                placeholder={t('auth:workspaceNamePlaceholder')}
                                value={newWorkspaceName}
                                onChange={(event) => setNewWorkspaceName(event.target.value)}
                              />
                              <Button
                                variant="outline"
                                joinItem
                                className="w-fit min-w-12"
                                disabled={newWorkspaceName.trim().length == 0 || creatingWorkspace}
                                type={'submit'}
                              >
                                {creatingWorkspace ? <UiLoading size="sm" /> : <FaArrowRight />}
                              </Button>
                            </ButtonGroup>
                          </FormControl>
                        </form>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : null}
              <Card>
                <CardBody className="flex flex-col items-center justify-center gap-2">
                  <CardTitle>{t('auth:joinWorkspace')}</CardTitle>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      joinWorkspace(joinWorkspaceId);
                    }}
                  >
                    <FormControl>
                      <Label>
                        <LabelText>{t('auth:joinCode')}</LabelText>
                      </Label>
                      <ButtonGroup className="w-full">
                        <Input
                          joinItem
                          className="w-full"
                          placeholder={t('auth:joinCode')}
                          value={joinWorkspaceId}
                          onChange={(event) => setJoinWorkspaceId(event.target.value)}
                        />
                        <Button
                          variant="outline"
                          joinItem
                          className="w-fit min-w-12"
                          disabled={joinWorkspaceId.trim().length == 0 || joiningWorkspace}
                          type={'submit'}
                        >
                          {joiningWorkspace ? <UiLoading size="sm" /> : <FaArrowRight />}
                        </Button>
                      </ButtonGroup>
                    </FormControl>
                  </form>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WorkspacesPage;
