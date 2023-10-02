import { ManageCard } from '../../../../components/manage/ManageCard';
import { ManageEntityLayout } from '../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '../../../../lib/context/UserContextProvider';
import React, { useContext } from 'react';
import { signOut } from 'next-auth/react';
import LoadingText from '../../../../components/LoadingText';
import Link from 'next/link';
import AvatarImage from '../../../../components/AvatarImage';

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
              <span className={'md:inline hidden'}> - Verwalten</span>
            </div>
          ) : (
            <div className={'flex flex-row items-center space-x-2'}>
              <LoadingText />
              <div> - Verwalten</div>
            </div>
          )
        }
        actions={[
          <div
            key={'profile'}
            className="dropdown dropdown-end border-base-200 border md:border-solid border-none rounded-xl"
          >
            <label tabIndex={0} className="btn btn-ghost">
              <>
                {userContext.user?.image ? (
                  <div className="avatar">
                    <div className="w-10 rounded-full">
                      <AvatarImage alt={'Profile Image'} src={userContext.user.image} />
                    </div>
                  </div>
                ) : (
                  <div className="avatar placeholder">
                    <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
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
              <div className={'md:inline hidden'}>{userContext.user?.name}</div>
            </label>
            <ul
              tabIndex={0}
              className="mt-2 z-[1] p-2 gap-2 shadow menu menu-sm dropdown-content bg-base-100 border-base-200 border rounded-box w-52"
            >
              <div className={'md:hidden text-center font-bold text-lg pt-1'}>{userContext.user?.name}</div>
              <div className={'md:hidden divider-sm'}></div>
              <li className={'btn btn-sm btn-outline'}>
                <Link href={'/'}>Workspaces</Link>
              </li>
              <div className={'divider-sm'}></div>
              <button
                className={'btn btn-sm btn-outline btn-error'}
                onClick={async () => {
                  await router.replace('/');
                  await signOut();
                }}
              >
                Abmelden
              </button>
            </ul>
          </div>,
        ]}
      >
        <div className={'grid md:grid-cols-2 md:gap-4 grid-cols-1 gap-2'}>
          <ManageCard title={'Cocktails'} link={`/workspaces/${workspaceId}/manage/cocktails`} />
          <ManageCard title={'Karten'} link={`/workspaces/${workspaceId}/manage/cards`} />
          <ManageCard title={'Zutaten'} link={`/workspaces/${workspaceId}/manage/ingredients`} />
          <ManageCard title={'Garnituren'} link={`/workspaces/${workspaceId}/manage/garnishes`} />
          <ManageCard title={'Gläser'} link={`/workspaces/${workspaceId}/manage/glasses`} />
          <>
            {userContext.isUserManager() && (
              <ManageCard title={'Workspace-Einstellungen'} link={`/workspaces/${workspaceId}/manage/settings`} />
            )}
          </>
          <ManageCard title={'Kalkulation'} link={`/workspaces/${workspaceId}/manage/calculations`} />
        </div>
      </ManageEntityLayout>
    </>
  );
}
