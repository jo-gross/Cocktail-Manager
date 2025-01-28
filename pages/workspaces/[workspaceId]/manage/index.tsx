import { ManageCard } from '../../../../components/manage/ManageCard';
import { ManageEntityLayout } from '../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '../../../../lib/context/UserContextProvider';
import React, { useContext } from 'react';
import { signOut } from 'next-auth/react';
import LoadingText from '../../../../components/LoadingText';
import Link from 'next/link';
import AvatarImage from '../../../../components/AvatarImage';
import { FaCalculator, FaCocktail, FaGlassMartiniAlt, FaUsers } from 'react-icons/fa';
import { LuCitrus } from 'react-icons/lu';
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
              <>
                {userContext.user?.image ? (
                  <div className="avatar">
                    <div className="w-10 rounded-full">
                      <AvatarImage alt={'Profile Image'} src={userContext.user.image} />
                    </div>
                  </div>
                ) : (
                  <div className="avatar placeholder">
                    <div className="rounded-full border bg-neutral p-2 text-neutral-content">
                      <span className="text-xs">
                        {userContext.user?.name
                          ?.split(' ')
                          .map((s) => s.charAt(0))
                          .join('')}
                      </span>
                    </div>
                  </div>
                )}
              </>
              <div className={'hidden md:inline'}>{userContext.user?.name}</div>
            </label>
            <ul tabIndex={0} className="menu dropdown-content menu-sm z-[1] mt-2 w-52 gap-2 rounded-box border border-base-200 bg-base-100 p-2 shadow">
              <div className={'pt-1 text-center text-lg font-bold md:hidden'}>{userContext.user?.name}</div>
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
          <ManageCard icon={<FaCocktail />} title={'Cocktails'} link={`/workspaces/${workspaceId}/manage/cocktails`} />
          <ManageCard icon={<PiCards />} title={'Karten'} link={`/workspaces/${workspaceId}/manage/cards`} />
          <ManageCard icon={<PiBeerBottleBold />} title={'Zutaten'} link={`/workspaces/${workspaceId}/manage/ingredients`} />
          <ManageCard icon={<LuCitrus />} title={'Garnituren'} link={`/workspaces/${workspaceId}/manage/garnishes`} />
          <ManageCard icon={<FaGlassMartiniAlt />} title={'Gläser'} link={`/workspaces/${workspaceId}/manage/glasses`} />
          <ManageCard icon={<FaCalculator />} title={'Mengen-Kalkulation'} link={`/workspaces/${workspaceId}/manage/calculations`} />
          <ManageCard icon={<IoMdStats />} title={'Statistiken'} link={`/workspaces/${workspaceId}/manage/statistics`} />
          <ManageCard icon={<FaGear />} title={'Einstellungen'} link={`/workspaces/${workspaceId}/manage/settings`} />
          <ManageCard icon={<FaUsers />} title={'Nutzer'} link={`/workspaces/${workspaceId}/manage/settings/users`} />
        </div>
      </ManageEntityLayout>
    </>
  );
}
