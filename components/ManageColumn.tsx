import { FaTrashAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { alertService } from '../lib/alertService';
import { useContext } from 'react';
import { UserContext } from '../lib/context/UserContextProvider';
import Link from 'next/link';

interface ManageColumnProps {
  id: string;
  entity: 'cocktails' | 'ingredients' | 'glasses' | 'garnishes';
  onRefresh: () => void;
}

export function ManageColumn(props: ManageColumnProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);

  return (
    <td>
      <>
        {userContext.isUserManager() ? (
          <div className={'flex justify-end space-x-2 items-center'}>
            <Link href={`/workspaces/${workspaceId}/manage/${props.entity}/${props.id}`}>
              <div className={'btn btn-outline btn-primary btn-sm'}>Edit</div>
            </Link>
            <button
              type={'button'}
              className={'btn btn-outline btn-error btn-sm'}
              disabled={!userContext.isUserAdmin()}
              onClick={async () => {
                fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}`, {
                  method: 'DELETE',
                })
                  .then(async (response) => {
                    const body = await response.json();
                    if (response.ok) {
                      props.onRefresh();
                      alertService.success('Erfolgreich gelöscht');
                    } else {
                      console.log(`ManageColumn[${props.entity}] -> delete`, response, body);
                      alertService.error(body.message, response.status, response.statusText);
                    }
                  })
                  .catch((error) => alert(error.message));
              }}
            >
              <FaTrashAlt />
            </button>
          </div>
        ) : (
          <></>
        )}
      </>
    </td>
  );
}
