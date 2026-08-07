import { ManageCard } from '@components/manage/ManageCard';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '@lib/auth-client';
import LoadingText from '../../../../components/LoadingText';
import Link from 'next/link';
import AvatarImage from '../../../../components/AvatarImage';
import { FaCalculator, FaCocktail, FaGlassMartiniAlt, FaKey, FaUsers } from 'react-icons/fa';
import { LuCitrus, LuHistory, LuMonitorPlay } from 'react-icons/lu';
import { PiBeerBottleBold, PiCards } from 'react-icons/pi';
import { FaGear } from 'react-icons/fa6';
import { IoMdStats } from 'react-icons/io';
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
            <div className={'w-max'}>{userContext.workspace.name}</div>
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
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">{t('nav:section.cocktails')}</Divider>

            <ManageCard icon={<FaCocktail />} title={t('nav:cocktails')} link={`/workspaces/${workspaceId}/manage/cocktails`} />
            <ManageCard icon={<PiBeerBottleBold />} title={t('nav:ingredients')} link={`/workspaces/${workspaceId}/manage/ingredients`} />
            <ManageCard icon={<LuCitrus />} title={t('nav:garnishes')} link={`/workspaces/${workspaceId}/manage/garnishes`} />
            <ManageCard icon={<FaGlassMartiniAlt />} title={t('nav:glasses')} link={`/workspaces/${workspaceId}/manage/glasses`} />
          </div>

          {userContext.isUserPermitted('MANAGER') && (
            <>
              <div className={'flex flex-col gap-2'}>
                <Divider className="col-span-full">{t('nav:section.display')}</Divider>
                <ManageCard icon={<PiCards />} title={t('nav:cards')} link={`/workspaces/${workspaceId}/manage/cards`} />
                <ManageCard icon={<LuMonitorPlay />} title={t('nav:monitor')} link={`/workspaces/${workspaceId}/manage/monitor`} />
              </div>
            </>
          )}

          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">{t('nav:section.numbers')}</Divider>
            <ManageCard icon={<IoMdStats />} title={t('nav:statistics')} link={`/workspaces/${workspaceId}/manage/statistics`} />
            <ManageCard icon={<FaCalculator />} title={t('nav:calculations')} link={`/workspaces/${workspaceId}/manage/calculations`} />
            <ManageCard icon={<LuHistory />} title={t('nav:logs')} link={`/workspaces/${workspaceId}/manage/logs`} />
          </div>

          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">{t('nav:section.workspace')}</Divider>
            <ManageCard icon={<FaUsers />} title={t('nav:users')} link={`/workspaces/${workspaceId}/manage/settings/users`} />
            {userContext.isUserPermitted('ADMIN') && (
              <>
                <ManageCard icon={<FaGear />} title={t('nav:settings')} link={`/workspaces/${workspaceId}/manage/settings`} />
                <ManageCard icon={<FaKey />} title={t('nav:apiKeys')} link={`/workspaces/${workspaceId}/manage/settings/api-keys`} />
              </>
            )}
          </div>
        </div>
      </ManageEntityLayout>
    </>
  );
}
