import { FaEllipsisV, FaRegClone, FaRegEdit, FaTrashAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { useContext, useState } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import Link from 'next/link';
import { Role } from '@generated/prisma/client';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { DeleteConfirmationModal } from './modals/DeleteConfirmationModal';
import InputModal from './modals/InputModal';

interface ManageColumnProps {
  id: string;
  name: string;
  entity: 'cocktails' | 'ingredients' | 'glasses' | 'garnishes' | 'calculations';
  onRefresh: () => void;
  editRole?: Role;
  deleteRole?: Role;
}

interface Reference {
  id: string;
  name: string;
}

export function ManageColumn(props: ManageColumnProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const [isCheckingReferences, setIsCheckingReferences] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDeleteClick = async () => {
    // Prüfe Referenzen nur für ingredients und glasses
    if ((props.entity === 'ingredients' || props.entity === 'glasses') && workspaceId) {
      setIsCheckingReferences(true);
      try {
        const referencesResponse = await fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}/references`);
        const referencesData = await referencesResponse.json();

        if (referencesResponse.ok && referencesData.data?.inUse && referencesData.data.cocktails) {
          // Öffne Modal mit Referenzen
          modalContext.openModal(
            <DeleteConfirmationModal
              spelling={'DELETE'}
              entityName={props.name}
              entityType={props.entity === 'ingredients' ? 'ingredient' : 'glass'}
              references={referencesData.data.cocktails}
              onApprove={async () => {
                const response = await fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}`, {
                  method: 'DELETE',
                });

                const body = await response.json();
                if (response.ok) {
                  props.onRefresh();
                  alertService.success('Erfolgreich gelöscht');
                } else {
                  console.error(`ManageColumn[${props.entity}] -> delete`, response);
                  alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
                }
              }}
            />,
          );
        } else {
          // Keine Referenzen gefunden, normale Löschbestätigung
          modalContext.openModal(
            <DeleteConfirmationModal
              spelling={'DELETE'}
              entityName={props.name}
              entityType={props.entity === 'ingredients' ? 'ingredient' : 'glass'}
              onApprove={async () => {
                const response = await fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}`, {
                  method: 'DELETE',
                });

                const body = await response.json();
                if (response.ok) {
                  props.onRefresh();
                  alertService.success('Erfolgreich gelöscht');
                } else {
                  console.error(`ManageColumn[${props.entity}] -> delete`, response);
                  alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
                }
              }}
            />,
          );
        }
      } catch (error) {
        console.error(`ManageColumn[${props.entity}] -> check references`, error);
        alertService.error('Fehler beim Prüfen der Referenzen');
      } finally {
        setIsCheckingReferences(false);
      }
    } else {
      // Für andere Entitäten: Normale Löschbestätigung ohne Referenzprüfung
      modalContext.openModal(
        <DeleteConfirmationModal
          spelling={'DELETE'}
          entityName={props.name}
          onApprove={async () => {
            const response = await fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}`, {
              method: 'DELETE',
            });

            const body = await response.json();
            if (response.ok) {
              props.onRefresh();
              alertService.success('Erfolgreich gelöscht');
            } else {
              console.error(`ManageColumn[${props.entity}] -> delete`, response);
              alertService.error(body.message ?? 'Fehler beim Löschen', response.status, response.statusText);
            }
          }}
        />,
      );
    }
  };

  const handleDuplicateClick = () => {
    if (!workspaceId) return;

    const entityLabels: Record<typeof props.entity, { title: string; successMessage: string; errorMessage: string }> = {
      cocktails: {
        title: 'Cocktail duplizieren',
        successMessage: 'Cocktail erfolgreich dupliziert',
        errorMessage: 'Fehler beim Duplizieren des Cocktails',
      },
      ingredients: {
        title: 'Zutat duplizieren',
        successMessage: 'Zutat erfolgreich dupliziert',
        errorMessage: 'Fehler beim Duplizieren der Zutat',
      },
      glasses: {
        title: 'Glas duplizieren',
        successMessage: 'Glas erfolgreich dupliziert',
        errorMessage: 'Fehler beim Duplizieren des Glases',
      },
      garnishes: {
        title: 'Garnitur duplizieren',
        successMessage: 'Garnitur erfolgreich dupliziert',
        errorMessage: 'Fehler beim Duplizieren der Garnitur',
      },
      calculations: {
        title: '',
        successMessage: '',
        errorMessage: '',
      },
    };

    const labels = entityLabels[props.entity];
    if (!labels.title) return; // calculations wird nicht unterstützt

    modalContext.openModal(
      <InputModal
        title={labels.title}
        description={'Geben Sie einen Namen für die Kopie ein:'}
        onInputSubmit={async (value) => {
          try {
            setIsDuplicating(true);
            const response = await fetch(`/api/workspaces/${workspaceId}/${props.entity}/${props.id}/clone`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ name: value }),
            });

            const body = await response.json();
            if (response.ok) {
              alertService.success(labels.successMessage);
              props.onRefresh();
              await router.push(`/workspaces/${workspaceId}/manage/${props.entity}/${body.data.id}`);
            } else {
              console.error(`ManageColumn -> duplicate${props.entity}`, response);
              alertService.error(body.message ?? labels.errorMessage, response.status, response.statusText);
            }
          } catch (error) {
            console.error(`ManageColumn -> duplicate${props.entity}`, error);
            alertService.error(labels.errorMessage);
            throw error;
          } finally {
            setIsDuplicating(false);
          }
        }}
        allowEmpty={false}
        defaultValue={props.name + ' - Kopie'}
      />,
    );
  };

  const canEdit = userContext.isUserPermitted(props.editRole ?? Role.MANAGER);
  const canDelete = userContext.isUserPermitted(props.deleteRole ?? Role.ADMIN);
  const canDuplicate =
    (props.entity === 'cocktails' ||
      props.entity === 'ingredients' ||
      props.entity === 'glasses' ||
      props.entity === 'garnishes') &&
    userContext.isUserPermitted(Role.MANAGER);

  if (!canEdit) {
    return <td></td>;
  }

  return (
    <td>
      <div className={'flex items-center justify-end'}>
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-sm">
            <FaEllipsisV />
          </label>
          <ul tabIndex={0} className="menu dropdown-content menu-sm z-[1] mt-2 w-52 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow">
            <li>
              <Link href={`/workspaces/${workspaceId}/manage/${props.entity}/${props.id}`} className="flex items-center gap-2">
                <FaRegEdit />
                Bearbeiten
              </Link>
            </li>
            {canDuplicate && (
              <li>
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={handleDuplicateClick}
                  disabled={isDuplicating}
                >
                  {isDuplicating ? <span className={'loading loading-spinner loading-sm'} /> : <FaRegClone />}
                  Duplizieren
                </button>
              </li>
            )}
            {canDelete && (
              <li>
                <button
                  type="button"
                  className="flex items-center gap-2 text-error"
                  onClick={handleDeleteClick}
                  disabled={isCheckingReferences}
                >
                  {isCheckingReferences ? <span className={'loading loading-spinner loading-sm'} /> : <FaTrashAlt />}
                  Löschen
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </td>
  );
}
