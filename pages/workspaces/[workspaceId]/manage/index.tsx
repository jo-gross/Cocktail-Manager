import { ManageCard } from '@components/manage/ManageCard';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import React, { useContext } from 'react';
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
import { Button, Divider, Dropdown, DropdownContent, Menu } from '@components/ui';

export default function ManagePage() {
  const router = useRouter();

  const userContext = useContext(UserContext);

  const { workspaceId } = router.query;
  return (
    <>
      <ManageEntityLayout
        backLink={`/workspaces/${workspaceId}`}
        title={
          userContext.workspace?.name ? (
            <div className={'w-max'}>
              {userContext.workspace.name}
              <span className={'hidden md:inline'}> - Verwalten</span>
            </div>
          ) : (
            <div className={'flex flex-row items-center space-x-2'}>
              <LoadingText />
              <div> - Verwalten</div>
            </div>
          )
        }
        actions={[
          <Dropdown key="profile" align="end">
            <Button type="button" variant="outline" tabIndex={0}>
              {userContext.user?.image && (
                <div className="h-10 w-10 overflow-hidden rounded-full">
                  <AvatarImage alt="Profile Image" src={userContext.user.image} />
                </div>
              )}
              <div className={'hidden md:flex md:flex-col md:items-start'}>
                <span>{userContext.user?.name || 'Demo Nutzer'}</span>
                {userContext.workspace?.users && (
                  <span className="text-xs font-normal opacity-70">
                    {userContext.workspace.users.find((u) => u.userId === userContext.user?.id)?.role || 'MANAGER'}
                  </span>
                )}
              </div>
            </Button>
            <DropdownContent tabIndex={0} className="z-[1] mt-2 block w-52">
              <Menu size="sm" className="gap-2">
                <div className={'pt-1 text-center md:hidden'}>
                  <div className="text-lg font-bold">{userContext.user?.name || 'Demo Nutzer'}</div>
                  {userContext.workspace?.users && (
                    <div className="mt-1 text-xs font-normal opacity-70">
                      {userContext.workspace.users.find((u) => u.userId === userContext.user?.id)?.role || 'MANAGER'}
                    </div>
                  )}
                </div>
                <li>
                  <Link href="/">
                    <Button variant="outline" size="sm" className="w-full">
                      Workspaces
                    </Button>
                  </Link>
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
                    Abmelden
                  </Button>
                </li>
                <Divider size="sm" />
                <li className="text-center">
                  v{packageInfo.version} -{' '}
                  <Link className={'link'} href={'https://github.com/jo-gross/Cocktail-Manager/releases'} target={'_blank'}>
                    Changelog
                  </Link>{' '}
                </li>
              </Menu>
            </DropdownContent>
          </Dropdown>,
        ]}
      >
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">Cocktails</Divider>

            <ManageCard icon={<FaCocktail />} title={'Cocktails'} link={`/workspaces/${workspaceId}/manage/cocktails`} />
            <ManageCard icon={<PiBeerBottleBold />} title={'Zutaten'} link={`/workspaces/${workspaceId}/manage/ingredients`} />
            <ManageCard icon={<LuCitrus />} title={'Garnituren'} link={`/workspaces/${workspaceId}/manage/garnishes`} />
            <ManageCard icon={<FaGlassMartiniAlt />} title={'Gläser'} link={`/workspaces/${workspaceId}/manage/glasses`} />
          </div>

          {userContext.isUserPermitted('MANAGER') && (
            <>
              <div className={'flex flex-col gap-2'}>
                <Divider className="col-span-full">Darstellung</Divider>
                <ManageCard icon={<PiCards />} title={'Bartender-Karten'} link={`/workspaces/${workspaceId}/manage/cards`} />
                <ManageCard icon={<LuMonitorPlay />} title={'Externer Monitor'} link={`/workspaces/${workspaceId}/manage/monitor`} />
              </div>
            </>
          )}

          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">Zahlen</Divider>
            <ManageCard icon={<IoMdStats />} title={'Statistik'} link={`/workspaces/${workspaceId}/manage/statistics`} />
            <ManageCard icon={<FaCalculator />} title={'Mengen-Kalkulation'} link={`/workspaces/${workspaceId}/manage/calculations`} />
            <ManageCard icon={<LuHistory />} title={'Buchungs-Logs'} link={`/workspaces/${workspaceId}/manage/logs`} />
          </div>

          <div className={'flex flex-col gap-2'}>
            <Divider className="col-span-full">Workspace</Divider>
            <ManageCard icon={<FaUsers />} title={'Nutzer'} link={`/workspaces/${workspaceId}/manage/settings/users`} />
            {userContext.isUserPermitted('ADMIN') && (
              <>
                <ManageCard icon={<FaGear />} title={'Einstellungen'} link={`/workspaces/${workspaceId}/manage/settings`} />
                <ManageCard icon={<FaKey />} title={'API Keys'} link={`/workspaces/${workspaceId}/manage/settings/api-keys`} />
              </>
            )}
          </div>
        </div>
      </ManageEntityLayout>
    </>
  );
}
