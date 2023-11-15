import { FaTrashAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { alertService } from '../lib/alertService';
import { useContext } from 'react';
import { UserContext } from '../lib/context/UserContextProvider';
import Link from 'next/link';
import { Role } from '@prisma/client';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { DeleteConfirmationModal } from './modals/DeleteConfirmationModal';

interface ManageColumnProps {
  id: string;
  entity: 'cocktails' | 'ingredients' | 'glasses' | 'garnishes' | 'calculations';
  onRefresh: () => void;
  editRole?: Role;
  deleteRole?: Role;
}

export function ManageColumn(props: ManageColumnProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  return (
    <td>
      <>
        {userContext.isUserPermitted(props.editRole ?? Role.MANAGER) ? (
          <div className={'flex items-center justify-end space-x-2'}>
            <Link href={`/workspaces/${workspaceId}/manage/${props.entity}/${props.id}`}>
              <div className={'btn btn-outline btn-primary btn-sm'}>Edit</div>
            </Link>
            <button
              type={'button'}
              className={'btn btn-outline btn-error btn-sm'}
              disabled={!userContext.isUserPermitted(props.deleteRole ?? Role.ADMIN)}
              onClick={() => {
                modalContext.openModal(
                  <DeleteConfirmationModal
                    spelling={'DELETE'}
                    onApprove={async () => {
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
                  />,
                );
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
