import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { FaPlus } from 'react-icons/fa';
import Link from 'next/link';
import { CocktailCardFull } from '../../../../../models/CocktailCardFull';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { UserContext } from '@lib/context/UserContextProvider';
import { Role } from '@generated/prisma/client';
import CardOverviewItem from '../../../../../components/cards/CardOverviewItem';
import ListSearchField from '../../../../../components/ListSearchField';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import { Button, Divider, Skeleton } from '@components/ui';
import { formatDateLocal, getLogicalDate } from '@lib/dateHelpers';

function cardFilter(filterString: string) {
  const normalizedFilter = filterString.trim().toLowerCase();
  return (card: CocktailCardFull) => normalizedFilter === '' || card.name.toLowerCase().includes(normalizedFilter);
}

const CardsOverviewPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [cards, setCards] = useState<CocktailCardFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterString, setFilterString] = useState('');
  const [dayStartTime, setDayStartTime] = useState<string | undefined>(undefined);

  const today = useMemo(() => formatDateLocal(getLogicalDate(new Date(), dayStartTime)), [dayStartTime]);

  const fetchCards = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cards?withArchived=true`)
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

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.statisticDayStartTime) {
          setDayStartTime(data.data.statisticDayStartTime);
        }
      })
      .catch(console.error);
  }, [workspaceId]);

  CardsOverviewPage.pullToRefresh = () => {
    fetchCards();
  };

  const activeCards = cards
    .filter((card) => !card.archived)
    .filter(cardFilter(filterString))
    .sort((a, b) => a.name.localeCompare(b.name));
  const archivedCards = cards
    .filter((card) => card.archived)
    .filter(cardFilter(filterString))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Karten'}
      actions={
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/cards/create`}>
            <Button variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10">
              <FaPlus />
            </Button>
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`card-skeleton-${index}`} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : cards.length == 0 ? (
        <div className={'text-center'}>Keine Einträge gefunden</div>
      ) : (
        <div className="flex flex-col gap-4">
          <ListSearchField onFilterChange={setFilterString} />
          {activeCards.length == 0 && archivedCards.length == 0 ? (
            <div className="text-center">Keine Karten gefunden</div>
          ) : (
            <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4'}>
              {activeCards.length == 0 ? (
                <div className="col-span-full text-center text-base-content/70">Keine aktiven Karten gefunden</div>
              ) : (
                activeCards.map((card) => <CardOverviewItem key={'card-' + card.id} card={card} workspaceId={workspaceId as string} today={today} />)
              )}

              {archivedCards.length > 0 ? (
                <>
                  <Divider className="col-span-full">Archiviert</Divider>
                  {archivedCards.map((card) => (
                    <CardOverviewItem key={'card-' + card.id} card={card} workspaceId={workspaceId as string} today={today} />
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </ManageEntityLayout>
  );
};

export default CardsOverviewPage;
