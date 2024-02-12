import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { FaPlus, FaRegEdit } from 'react-icons/fa';
import Link from 'next/link';
import { CocktailCardFull } from '../../../../../models/CocktailCardFull';
import React, { useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { Role } from '@prisma/client';

export default function CardsOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [cards, setCards] = useState<CocktailCardFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cards`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCards(body.data);
        } else {
          console.error('Cards -> fetchCards', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Karten', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Cards -> fetchCards', error);
        alertService.error('Fehler beim Laden der Karten');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Karten'}
      actions={
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/cards/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <Loading />
      ) : cards.length == 0 ? (
        <div className={'text-center'}>Keine Einträge gefunden</div>
      ) : (
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
          {cards
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((card) => (
              <div key={'card-' + card.id} className={'card'}>
                <div className={'card-body'}>
                  <div className={'card-title'}>
                    {card.name} {card.date != undefined ? `(${new Date(card.date).toLocaleDateString()})` : ''}
                  </div>
                  <div className={'grid grid-cols-2'}>
                    <div>{card.groups?.length} Gruppen</div>
                    <div>{card.groups?.reduce((acc, group) => acc + group.items.length, 0)} Cocktails</div>
                  </div>
                  <>
                    {userContext.isUserPermitted(Role.MANAGER) && (
                      <div className="card-actions justify-end">
                        <Link href={`/workspaces/${workspaceId}/manage/cards/${card.id}`}>
                          <div className="btn btn-primary">
                            <FaRegEdit />
                          </div>
                        </Link>
                      </div>
                    )}
                  </>
                </div>
              </div>
            ))}
        </div>
      )}
    </ManageEntityLayout>
  );
}
