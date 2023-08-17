import { ManageCard } from '../../../../components/manage/ManageCard';
import { ManageEntityLayout } from '../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { UserContext } from '../../../../lib/context/UserContextProvider';
import { useContext } from 'react';
import { signOut } from 'next-auth/react';

export default function ManagePage() {
  const router = useRouter();

  const userContext = useContext(UserContext);

  const { workspaceId } = router.query;
  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}`}
      title={`${userContext.workspace?.name}-Verwalten`}
      actions={[
        <div key={'profile'} className="dropdown dropdown-end border border-base-200 rounded-xl">
          <label tabIndex={0} className="btn btn-ghost">
            <>
              {userContext.user?.image ? (
                <div className="avatar">
                  <div className="w-8 rounded-full">
                    <img referrerPolicy="no-referrer" src={userContext.user?.image} />
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
            <div>{userContext.user?.name}</div>
          </label>
          <ul
            tabIndex={0}
            className="mt-3 z-[1] p-2 gap-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
          >
            <li className={'border rounded-xl'}>
              <a href={'/'}>Workspaces</a>
            </li>
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
        <ManageCard title={'Admin'} link={`/workspaces/${workspaceId}/manage/admin`} />
      </div>
    </ManageEntityLayout>
  );
}
