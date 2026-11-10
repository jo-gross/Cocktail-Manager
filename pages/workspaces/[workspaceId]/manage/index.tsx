import { ManageGroup, ManageLink } from '@components/manage/ManageCard';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '@lib/auth-client';
import LoadingText from '../../../../components/LoadingText';
import Link from 'next/link';
import AvatarImage from '../../../../components/AvatarImage';
import { WorkspaceLogo } from '@components/workspaces/WorkspaceLogo';
import { FaCalculator, FaCocktail, FaGlassMartiniAlt, FaUsers } from 'react-icons/fa';
import { LuCitrus, LuHistory, LuMonitorPlay, LuShieldAlert } from 'react-icons/lu';
import { PiBeerBottleBold, PiCards } from 'react-icons/pi';
import { FaGear } from 'react-icons/fa6';
import { IoMdStats } from 'react-icons/io';
import { MdOutlineMenuBook, MdOutlineSell } from 'react-icons/md';
import packageInfo from '../../../../package.json';
import LanguageChanger from '@components/LanguageChanger';
import { Button, Divider, Dropdown, DropdownContent, Menu } from '@components/ui';

export default function ManagePage() {
  const router = useRouter();
  const { t } = useTranslation(['nav', 'auth', 'common']);

  const userContext = useContext(UserContext);

  const { workspaceId } = router.query;
  return (
    <>
      <ManageEntityLayout
        backLink={`/workspaces/${workspaceId}`}
        title={
          userContext.workspace?.name ? (
            <div className="flex items-center gap-3">
              <WorkspaceLogo image={userContext.workspace.image} name={userContext.workspace.name} className="h-12 w-12 md:h-16 md:w-16" />
              <span className="break-words">{userContext.workspace.name}</span>
            </div>
          ) : (
            <div className={'flex flex-row items-center space-x-2'}>
              <LoadingText />
            </div>
          )
        }
        actions={[
          <Dropdown key="profile" align="end">
            <Button type="button" variant="outline" tabIndex={0}>
              {userContext.user?.image && (
                <div className="h-10 w-10 overflow-hidden rounded-full">
                  <AvatarImage alt={t('common:profileImageAlt')} src={userContext.user.image} />
                </div>
              )}
              <div className={'hidden md:flex md:flex-col md:items-start'}>
                <span>{userContext.user?.name || t('auth:demoUser')}</span>
                {userContext.workspace?.members && (
                  <span className="text-xs font-normal opacity-70">
                    {userContext.workspace.members.find((m) => m.userId === userContext.user?.id)?.role || 'MANAGER'}
                  </span>
                )}
              </div>
            </Button>
            <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-52">
              <Menu size="sm" className="gap-2">
                <div className={'pt-1 text-center md:hidden'}>
                  <div className="text-lg font-bold">{userContext.user?.name || t('auth:demoUser')}</div>
                  {userContext.workspace?.members && (
                    <div className="mt-1 text-xs font-normal opacity-70">
                      {userContext.workspace.members.find((m) => m.userId === userContext.user?.id)?.role || 'MANAGER'}
                    </div>
                  )}
                </div>
                <li>
                  <Link href="/">
                    <Button variant="outline" size="sm" className="w-full">
                      {t('nav:workspaces')}
                    </Button>
                  </Link>
                </li>
                <Divider size="sm" />
                <li className="flex justify-center px-1 py-1">
                  <LanguageChanger size="sm" />
                </li>
                <Divider size="sm" />
                <li>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-error text-error hover:bg-error/10"
                    onClick={async () => {
                      await router.replace('/');
                      await authClient.signOut();
                    }}
                  >
                    {t('nav:logout')}
                  </Button>
                </li>
                <Divider size="sm" />
                <li className="text-center">
                  {t('common:versionLine', { version: packageInfo.version, env: '' })} -{' '}
                  <Link className={'link'} href={'https://github.com/jo-gross/Cocktail-Manager/releases'} target={'_blank'}>
                    {t('nav:changelog')}
                  </Link>{' '}
                </li>
              </Menu>
            </DropdownContent>
          </Dropdown>,
        ]}
      >
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <ManageGroup title={t('nav:section.recipes')}>
              <ManageLink
                icon={<FaCocktail />}
                title={t('nav:cocktails')}
                description={t('nav:overview.description.cocktails')}
                link={`/workspaces/${workspaceId}/manage/cocktails`}
              />
              <ManageLink
                icon={<PiBeerBottleBold />}
                title={t('nav:ingredients')}
                description={t('nav:overview.description.ingredients')}
                link={`/workspaces/${workspaceId}/manage/ingredients`}
              />
              <ManageLink
                icon={<LuCitrus />}
                title={t('nav:garnishes')}
                description={t('nav:overview.description.garnishes')}
                link={`/workspaces/${workspaceId}/manage/garnishes`}
              />
              <ManageLink
                icon={<FaGlassMartiniAlt />}
                title={t('nav:glasses')}
                description={t('nav:overview.description.glasses')}
                link={`/workspaces/${workspaceId}/manage/glasses`}
              />
            </ManageGroup>
            <ManageGroup title={t('nav:section.guestInfo')}>
              <ManageLink
                icon={<LuShieldAlert />}
                title={t('nav:overview.allergensAlcohol')}
                description={t('nav:overview.description.guestInfo')}
                link={`/workspaces/${workspaceId}/manage/guest-info`}
              />
              <ManageLink
                icon={<MdOutlineSell />}
                title={t('nav:overview.tagsFilters')}
                description={t('nav:overview.description.tags')}
                link={`/workspaces/${workspaceId}/manage/tags`}
              />
            </ManageGroup>
          </div>
          <div className="flex flex-col gap-6">
            {userContext.isUserPermitted('MANAGER') && (
              <ManageGroup title={t('nav:section.display')}>
                <ManageLink
                  icon={<PiCards />}
                  title={t('nav:cards')}
                  description={t('nav:overview.description.cards')}
                  link={`/workspaces/${workspaceId}/manage/cards`}
                />
                <ManageLink
                  icon={<MdOutlineMenuBook />}
                  title={t('nav:guestMenus')}
                  description={t('nav:overview.description.guestMenus')}
                  link={`/workspaces/${workspaceId}/manage/guest-menus`}
                />
                <ManageLink
                  icon={<LuMonitorPlay />}
                  title={t('nav:monitor')}
                  description={t('nav:overview.description.monitor')}
                  link={`/workspaces/${workspaceId}/manage/monitor`}
                />
              </ManageGroup>
            )}
            <ManageGroup title={t('nav:section.numbers')}>
              <ManageLink
                icon={<IoMdStats />}
                title={t('nav:statistics')}
                description={t('nav:overview.description.statistics')}
                link={`/workspaces/${workspaceId}/manage/statistics`}
              />
              <ManageLink
                icon={<FaCalculator />}
                title={t('nav:calculations')}
                description={t('nav:overview.description.calculations')}
                link={`/workspaces/${workspaceId}/manage/calculations`}
              />
              <ManageLink
                icon={<LuHistory />}
                title={t('nav:logs')}
                description={t('nav:overview.description.logs')}
                link={`/workspaces/${workspaceId}/manage/logs`}
              />
            </ManageGroup>
          </div>
          <ManageGroup title={t('nav:section.workspace')} className="lg:col-span-2">
            {userContext.isUserPermitted('ADMIN') ? (
              <ManageLink
                icon={<FaGear />}
                title={t('nav:settings')}
                description={t('nav:overview.description.settings')}
                link={`/workspaces/${workspaceId}/manage/settings`}
              />
            ) : (
              <ManageLink
                icon={<FaUsers />}
                title={t('nav:overview.members')}
                description={t('nav:overview.description.members')}
                link={`/workspaces/${workspaceId}/manage/settings/users`}
              />
            )}
          </ManageGroup>
        </div>
      </ManageEntityLayout>
    </>
  );
}
