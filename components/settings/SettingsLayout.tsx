import React, { useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import { FaBlender, FaDatabase, FaGear, FaGlobe, FaKey, FaLanguage, FaTriangleExclamation, FaUsers } from 'react-icons/fa6';
import { MdTranslate } from 'react-icons/md';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { cn } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { settingsHref, visibleSettingsNavGroups, type SettingsPageId } from './settingsNavigation';

const NAV_ICONS: Record<SettingsPageId, IconType> = {
  general: FaGear,
  public: FaGlobe,
  languages: FaLanguage,
  translations: MdTranslate,
  recipes: FaBlender,
  users: FaUsers,
  apiKeys: FaKey,
  data: FaDatabase,
  danger: FaTriangleExclamation,
};

interface SettingsLayoutProps {
  /** Active sub-page (highlighted in the navigation, provides title + description). */
  page: SettingsPageId;
  /** Page-level actions shown next to the page title. */
  actions?: React.ReactNode;
  unsavedChanges?: boolean;
  /** Let the content use the full width (e.g. for large editing tables). */
  wide?: boolean;
  children: React.ReactNode;
}

/** Shared frame for all workspace settings pages: sidebar (≥lg) / scrollable tab bar (mobile) + stacked sections. */
export function SettingsLayout({ page, actions, unsavedChanges, wide = false, children }: SettingsLayoutProps) {
  const { t } = useTranslation(['settings']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : '';
  // Without a workspace id (static prerender / first client render) the links would be `/workspaces//…`.
  const groups = workspaceId ? visibleSettingsNavGroups((role) => userContext.isUserPermitted(role)) : [];
  const activeMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeMobileLinkRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [page]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      alwaysUseBackLink
      title={t('settings:area.title')}
      subtitle={userContext.workspace?.name}
      unsavedChanges={unsavedChanges}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <aside className="hidden w-60 shrink-0 lg:sticky lg:top-24 lg:block">
          <nav aria-label={t('settings:area.navLabel')} className="flex flex-col gap-5">
            {groups.map(({ group, items }) => (
              <div key={group} className="flex flex-col gap-1">
                <h2 id={`settings-nav-${group}`} className="px-3 text-xs font-semibold tracking-wide text-base-content/60 uppercase">
                  {t(`settings:navGroups.${group}`)}
                </h2>
                <ul aria-labelledby={`settings-nav-${group}`} className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = NAV_ICONS[item.id];
                    const active = item.id === page;
                    return (
                      <li key={item.id}>
                        <Link
                          href={settingsHref(workspaceId, item.id)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                            active ? 'bg-primary/10 text-base-content' : 'text-base-content/70 hover:bg-base-200 hover:text-base-content',
                          )}
                        >
                          <Icon aria-hidden className={cn('shrink-0', active ? 'text-primary' : 'text-base-content/50')} />
                          {t(`settings:pages.${item.id}.title`)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <nav aria-label={t('settings:area.navLabel')} className="-mx-4 overflow-x-auto border-b border-base-300 md:-mx-5 lg:hidden">
          <ul className="flex w-max gap-1 px-4 md:px-5">
            {groups.flatMap(({ items }) =>
              items.map((item) => {
                const active = item.id === page;
                return (
                  <li key={item.id}>
                    <Link
                      ref={active ? activeMobileLinkRef : undefined}
                      href={settingsHref(workspaceId, item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        '-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                        active ? 'border-primary text-base-content' : 'border-transparent text-base-content/60 hover:text-base-content',
                      )}
                    >
                      {t(`settings:pages.${item.id}.title`)}
                    </Link>
                  </li>
                );
              }),
            )}
          </ul>
        </nav>

        <div className={cn('flex w-full min-w-0 flex-1 flex-col gap-4 md:gap-6', !wide && 'max-w-4xl')}>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl font-bold">{t(`settings:pages.${page}.title`)}</h1>
              <p className="text-sm text-base-content/70">{t(`settings:pages.${page}.description`)}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </div>
      </div>
    </ManageEntityLayout>
  );
}
