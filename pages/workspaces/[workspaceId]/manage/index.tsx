import { ManageCard } from '@components/manage/ManageCard';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import React, { useContext } from 'react';
import { signOut } from 'next-auth/react';
import LoadingText from '../../../../components/LoadingText';
import Link from 'next/link';
import AvatarImage from '../../../../components/AvatarImage';
import { FaCalculator, FaCocktail, FaGlassMartiniAlt, FaKey, FaUsers } from 'react-icons/fa';
import { LuCitrus, LuHistory, LuMonitorPlay } from 'react-icons/lu';
import { PiBeerBottleBold, PiCards } from 'react-icons/pi';
import { FaGear } from 'react-icons/fa6';
import { IoMdStats } from 'react-icons/io';
import packageInfo from '../../../../package.json';

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
          <div key={'profile'} className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-outline">
              {userContext.user?.image && (
                <div className="avatar">
                  <div className="w-10 rounded-full">
                    <AvatarImage alt={'Profile Image'} src={userContext.user.image} />
                  </div>
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
            </label>
            <ul tabIndex={0} className="menu dropdown-content menu-sm z-[1] mt-2 w-52 gap-2 rounded-box border border-base-200 bg-base-100 p-2 shadow">
              <div className={'pt-1 text-center md:hidden'}>
                <div className="text-lg font-bold">{userContext.user?.name || 'Demo Nutzer'}</div>
                {userContext.workspace?.users && (
                  <div className="mt-1 text-xs font-normal opacity-70">
                    {userContext.workspace.users.find((u) => u.userId === userContext.user?.id)?.role || 'MANAGER'}
                  </div>
                )}
              </div>
              <Link href={'/'} className={'btn btn-outline btn-sm'}>
                Workspaces
              </Link>

              <div className={'divider-sm'}></div>
              <button
                className={'btn btn-outline btn-error btn-sm'}
                onClick={async () => {
                  await router.replace('/');
                  await signOut();
                }}
              >
                Abmelden
              </button>
              <div className={'divider-sm'}></div>
              <div className={'text-center'}>
                v{packageInfo.version} -{' '}
                <Link className={'link'} href={'https://github.com/jo-gross/Cocktail-Manager/blob/master/docs/CHANGELOG.md'} target={'_blank'}>
                  Changelog
                </Link>{' '}
              </div>
            </ul>
          </div>,
        ]}
      >
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
          <div className={'flex flex-col gap-2'}>
            <div className={'divider col-span-full'}>Cocktails</div>

            <ManageCard icon={<FaCocktail />} title={'Cocktails'} link={`/workspaces/${workspaceId}/manage/cocktails`} />
            <ManageCard icon={<PiBeerBottleBold />} title={'Zutaten'} link={`/workspaces/${workspaceId}/manage/ingredients`} />
            <ManageCard icon={<LuCitrus />} title={'Garnituren'} link={`/workspaces/${workspaceId}/manage/garnishes`} />
            <ManageCard icon={<FaGlassMartiniAlt />} title={'Gläser'} link={`/workspaces/${workspaceId}/manage/glasses`} />
          </div>

          {userContext.isUserPermitted('MANAGER') && (
            <>
              <div className={'flex flex-col gap-2'}>
                <div className={'divider col-span-full'}>Darstellung</div>
                <ManageCard icon={<PiCards />} title={'Bartender-Karten'} link={`/workspaces/${workspaceId}/manage/cards`} />
                <ManageCard icon={<LuMonitorPlay />} title={'Externer Monitor'} link={`/workspaces/${workspaceId}/manage/monitor`} />
              </div>
            </>
          )}

          <div className={'flex flex-col gap-2'}>
            <div className={'divider col-span-full'}>Zahlen</div>
            <ManageCard icon={<IoMdStats />} title={'Statistik'} link={`/workspaces/${workspaceId}/manage/statistics`} />
            <ManageCard icon={<FaCalculator />} title={'Mengen-Kalkulation'} link={`/workspaces/${workspaceId}/manage/calculations`} />
            <ManageCard icon={<LuHistory />} title={'Buchungs-Logs'} link={`/workspaces/${workspaceId}/manage/logs`} />
          </div>

          <div className={'flex flex-col gap-2'}>
            <div className={'divider col-span-full'}>Workspace</div>
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
