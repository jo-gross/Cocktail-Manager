import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { upsertUserSettingRequest } from '@lib/network/userSettings';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getActiveLocale, i18n } from '@lib/i18n/client';
import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from '@lib/i18n/locales';
import type { UserSettingUpdateInput } from '@lib/schemas/userSettings';

interface AlertBoundaryProps {
  children: React.ReactNode;
}

export function AuthBoundary(props: AlertBoundaryProps) {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  // Use BetterAuth's useSession hook
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [user, setUser] = useState<(User & { settings: UserSetting[] }) | undefined>();
  const [userLoading, setUserLoading] = useState<boolean>(false);

  const [workspace, setWorkspace] = useState<WorkspaceDto | undefined>();
  const [translations, setTranslations] = useState<TranslationsDto>({});
  const [uiLocale, setUiLocale] = useState<AppLocale>(() => getActiveLocale());
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
          alertService.error(body.error?.message ?? body.message ?? t('auth:error.loadUser'), response.status, response.statusText);
          await authClient.signOut();
        }
      })
      .catch(async (error) => {
        console.error('AuthBoundary -> fetchUser', error);
        alertService.error(t('auth:error.loadUser'));
        await authClient.signOut();
      })
      .finally(async () => {
        setUserLoading(false);
      });
  }, [t]);

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

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      setUiLocale(normalizeLocale(lng));
    };
    i18n.on('languageChanged', onLanguageChanged);
    setUiLocale(getActiveLocale());
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const fetchWorkspace = useCallback(
    async (force = false) => {
      const workspaceId = router.query.workspaceId;
      if (!workspaceId) return;
      if (!force && workspaceId == workspace?.id) return;

      const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;
      setWorkspaceLoading(true);

      try {
        const workspaceData = await getWorkspace(wsId);
        setWorkspace(workspaceData);
      } catch (error) {
        console.error('AuthBoundary -> fetchWorkspace', error);
        await router.replace('/');
        alertApiV1Error(error, t('auth:error.loadWorkspace'));
        setWorkspaceLoading(false);
        return;
      }

      try {
        const translationsData = await getTranslations(wsId);
        setTranslations(translationsData ?? {});
      } catch (error) {
        // Keep existing catalog if the translation refetch fails (e.g. after a successful local patch).
        console.error('AuthBoundary -> fetchTranslations', error);
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [router, workspace?.id, t],
  );

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  const refreshWorkspace = useCallback(async () => {
    await fetchWorkspace(true);
  }, [fetchWorkspace]);

  const patchTranslations = useCallback((key: string, labels: Record<string, string>) => {
    setTranslations((previous) => {
      const next: TranslationsDto = { ...previous };
      for (const [locale, value] of Object.entries(labels)) {
        next[locale] = { ...(next[locale] ?? {}), [key]: value };
      }
      return next;
    });
  }, []);

  const getTranslationOrNull = useCallback(
    (key: string, language?: AppLocale) => {
      const locale = language ?? uiLocale;
      return translations?.[locale]?.[key] ?? (locale !== DEFAULT_LOCALE ? translations?.[DEFAULT_LOCALE]?.[key] : undefined) ?? undefined;
    },
    [translations, uiLocale],
  );

  const getTranslation = useCallback(
    (key: string, language?: AppLocale) => {
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
          uiLocale,
          refreshWorkspace: refreshWorkspace,
          refreshUser: fetchUser,
          workspaceRefreshing: workspaceLoading,
          patchTranslations,

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
            void (async () => {
              try {
                await upsertUserSettingRequest({ setting: setting as UserSettingUpdateInput['setting'], value });
                fetchUser();
              } catch (error) {
                console.error('AuthBoundary -> updateUserSetting', error);
                alertApiV1Error(error, t('auth:error.updateUserSettings'));
              }
            })();
          },
          getTranslation: getTranslation,
          getTranslationOrNull: getTranslationOrNull,
        }}
      >
        {userLoading ? (
          <PageCenter>
            <div className={'flex flex-col items-center justify-center gap-4'}>
              <Loading name={t('auth:loadingUser')} />
              <Button variant="outline" size="xs" className="border-error text-error hover:bg-error/10" onClick={cancelLogin}>
                {t('common:cancel')}
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
