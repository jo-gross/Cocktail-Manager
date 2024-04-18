import { Role } from '@prisma/client';
import Link from 'next/link';
import { FaRegClone, FaRegEdit } from 'react-icons/fa';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { CocktailCardFull } from '../../models/CocktailCardFull';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import InputModal from '../modals/InputModal';
import { alertService } from '../../lib/alertService';
import { useRouter } from 'next/router';

interface CardOverviewItemProps {
  card: CocktailCardFull;
  workspaceId: string;
}

export default function CardOverviewItem(props: CardOverviewItemProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  return (
    <div key={'card-' + props.card.id} className={'card'}>
      <div className={'card-body'}>
        <div className={`card-title ${props.card.archived ? 'italic' : ''}`}>
          {props.card.archived ? 'Archiviert:' : ''} {props.card.name}{' '}
          {props.card.date != undefined ? `(${new Date(props.card.date).toLocaleDateString()})` : ''}
        </div>
        <div className={'grid grid-cols-2'}>
          <div>{props.card.groups?.length} Gruppen</div>
          <div>{props.card.groups?.reduce((acc, group) => acc + group.items.length, 0)} Cocktails</div>
        </div>
        <>
          {userContext.isUserPermitted(Role.MANAGER) && (
            <div className="card-actions justify-end">
              <button
                type={'button'}
                className={'btn btn-outline btn-primary'}
                onClick={() =>
                  modalContext.openModal(
                    <InputModal
                      title={'Name'}
                      onInputSubmit={async (value) => {
                        try {
                          const response = await fetch(`/api/workspaces/${props.workspaceId}/cards/${props.card.id}/clone`, {
                            method: 'POST',
                            body: JSON.stringify({ name: value }),
                          });

                          const body = await response.json();
                          if (response.ok) {
                            await router.replace(`/workspaces/${props.workspaceId}/manage/cards/${body.data.id}`);
                            alertService.success('Karte erfolgreich dupliziert');
                          } else {
                            console.error('CardId -> cloneCard', response);
                            alertService.error(body.message ?? 'Fehler beim Duplizieren der Karte', response.status, response.statusText);
                          }
                        } catch (error) {
                          console.error('CardId -> cloneCard', error);
                          alertService.error('Fehler beim Duplizieren der Karte');
                          throw error;
                        }
                      }}
                      allowEmpty={false}
                      defaultValue={props.card.name + ' - Kopie'}
                    />,
                  )
                }
              >
                <FaRegClone />
                Duplizieren
              </button>
              <Link href={`/workspaces/${props.workspaceId}/manage/cards/${props.card.id}`}>
                <div className="btn btn-primary">
                  <FaRegEdit />
                  Bearbeiten
                </div>
              </Link>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
