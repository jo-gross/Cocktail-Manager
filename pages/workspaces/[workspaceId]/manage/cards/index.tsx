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
    fetch(`/api/workspaces/${workspaceId}/cards`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCards(body.data);
        } else {
          console.log('Cards -> fetchCards', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
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
            <div className={'btn btn-primary btn-square md:btn-md btn-sm'}>
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
        <div className={'grid md:grid-cols-2 grid-cols-1 md:gap-4 gap-2'}>
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
