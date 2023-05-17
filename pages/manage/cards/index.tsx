import { ManageEntityLayout } from '../../../components/layout/ManageEntityLayout';
import { FaRegEdit } from 'react-icons/fa';
import Link from 'next/link';
import { CocktailCardFull } from '../../../models/CocktailCardFull';
import { useEffect, useState } from 'react';
import { Loading } from '../../../components/Loading';

export default function CardsOverviewPage() {
  const [cards, setCards] = useState<CocktailCardFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cards')
      .then((response) => response.json())
      .then((data) => {
        setCards(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <ManageEntityLayout
      backLink={'/manage'}
      title={'Karten'}
      actions={
        <Link href={'/manage/cards/create'}>
          <div className={'btn btn-primary'}>Hinzufügen</div>
        </Link>
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <div className={'grid grid-cols-2 gap-4'}>
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
                  <div className="card-actions justify-end">
                    <Link href={`/manage/cards/${card.id}`}>
                      <div className="btn btn-primary">
                        <FaRegEdit />
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </ManageEntityLayout>
  );
}
