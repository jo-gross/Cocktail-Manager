import React, { useCallback, useContext, useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import prisma from '../lib/prisma';
import { FaEye, FaSearch } from 'react-icons/fa';
import Link from 'next/link';
import { BsFillGearFill } from 'react-icons/bs';
import { CocktailCardFull } from '../models/CocktailCardFull';
import CocktailRecipeOverviewItem from '../components/cocktails/CocktailRecipeOverviewItem';
import { CocktailCard } from '@prisma/client';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../models/CocktailRecipeFull';
import { ModalContext } from '../lib/context/ModalContextProvider';
import { SearchModal } from '../components/modals/SearchModal';
import { themeChange } from 'theme-change';
import { Loading } from '../components/Loading';

export const getServerSideProps: GetServerSideProps = async () => {
  const cocktails: CocktailRecipeFull[] = await prisma.cocktailRecipe.findMany({
    include: {
      glass: true,
      decoration: true,
      steps: {
        include: {
          ingredients: {
            include: {
              ingredient: true,
            },
          },
        },
      },
    },
  });

  const cards: CocktailCard[] = await prisma.cocktailCard.findMany({
    include: {
      groups: {
        include: {
          items: true,
        },
      },
    },
  });

  return {
    props: {
      cards: cards.map((card) => {
        return {
          ...card,
          date: card.date != undefined ? new Date(card.date).toISOString() : null,
        };
      }),
      cocktails,
    },
  };
};

export default function OverviewPage(props: { cards: CocktailCardFull[]; cocktails: CocktailRecipeFull[] }) {
  const modalContext = useContext(ModalContext);

  const [showImage, setShowImage] = useState(false);
  const [showTags, setShowTags] = useState(false);

  useEffect(() => {
    themeChange(false);
  }, []);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(
    props.cards.length > 0 ? props.cards[0].id : undefined,
  );
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(
    props.cards.length > 0 ? props.cards[0] : undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (selectedCardId != undefined) {
      try {
        fetch('/api/cards/' + selectedCardId).then((response) => {
          if (response.ok) {
            response
              .json()
              .then((json) => {
                console.log(json);
                return json;
              })
              .then((json) => setSelectedCard(json));
          }
        });
      } catch (e) {
        console.log(e);
      }
    }
  }, [selectedCardId]);

  const sortCards = useCallback((a: CocktailCard, b: CocktailCard) => {
    const today = new Date().toISOString().slice(0, 10);

    if (
      a.date != undefined &&
      new Date(a.date).toISOString().slice(0, 10) == today &&
      b.date != undefined &&
      new Date(b.date).toISOString().slice(0, 10) != today
    ) {
      return -1; // a (heutiges Datum) kommt vor b
    }
    if (
      a.date != undefined &&
      new Date(a.date).toISOString().slice(0, 10) != today &&
      b.date != undefined &&
      new Date(b.date).toISOString().slice(0, 10) == today
    ) {
      return 1; // b (heutiges Datum) kommt vor a
    }
    if (a.date == undefined && b.date != undefined) {
      return -1; // a (Datum Null) kommt vor b
    }
    if (a.date != undefined && b.date == undefined) {
      return 1; // b (Datum Null) kommt vor a
    }

    if (
      new Date(a.date ?? new Date()).toISOString().slice(0, 10) > today &&
      new Date(b.date ?? new Date()).toISOString().slice(0, 10) <= today
    ) {
      return -1; // a (zukünftiges Datum) kommt vor b
    }
    if (
      new Date(a.date ?? new Date()).toISOString().slice(0, 10) <= today &&
      new Date(b.date ?? new Date()).toISOString().slice(0, 10) > today
    ) {
      return 1; // b (zukünftiges Datum) kommt vor a
    }

    return a.name.localeCompare(b.name);
  }, []);

  useEffect(() => {
    if (selectedCardId == undefined && props.cards.length > 0) {
      setSelectedCardId(props.cards.sort(sortCards)[0].id);
      router.replace('/', { query: { card: props.cards[0].id } });
    }
  }, [props.cards, router, selectedCardId, sortCards]);

  return (
    <div className={'static h-screen'}>
      <div className={''}>
        <div className={'flex flex-col overflow-y-auto p-4 rounded-xl space-y-2'}>
          {selectedCard?.groups
            ?.sort((a, b) => a.groupNumber - b.groupNumber)
            .map((group) => (
              <div
                key={`card-${selectedCard.id}-group-${group.id}`}
                className={'border border-base-200 rounded-xl p-2'}
              >
                <div className={'font-bold text-2xl text-center'}>
                  {group.name}
                  {group.groupPrice && ` - Special Preis: ${group.groupPrice}€`}
                </div>
                <div
                  className={'grid 2xl:grid-cols-6 xl:grid-cols-4 md:grid-cols-3 xs:grid-cols-2 grid-cols-1 gap-2 p-2'}
                >
                  {group.items
                    ?.sort((a, b) => a.itemNumber - b.itemNumber)
                    .map((groupItem, index) => {
                      if (groupItem.cocktail != undefined) {
                        return (
                          <CocktailRecipeOverviewItem
                            key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}
                            showImage={showImage}
                            showTags={showTags}
                            showInfo={true}
                            showPrice={groupItem.specialPrice == undefined && group.groupPrice == undefined}
                            specialPrice={groupItem.specialPrice ?? group.groupPrice ?? undefined}
                            cocktailRecipe={groupItem.cocktail}
                          />
                        );
                      } else {
                        return (
                          <div
                            key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}
                          >
                            <Loading />
                          </div>
                        );
                      }
                    })}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className={'fixed bottom-5 right-5 flex flex-col space-y-2'}>
        <div className="dropdown dropdown-top dropdown-end pt-2">
          <label tabIndex={0} className={'btn btn-primary btn-square rounded-xl btn-lg'}>
            <FaEye />
          </label>
          <div tabIndex={0} className="dropdown-content p-2 shadow bg-base-100 rounded-box w-52">
            <div className={'flex flex-col space-x-2'}>
              <div className={'divider'}>Karte</div>
              <div className={'flex flex-col'}>
                {props.cards.length == 0 ? (
                  <div>Keine Karten vorhanden</div>
                ) : (
                  props.cards.sort(sortCards).map((card) => (
                    <div key={'card-' + card.id} className="form-control">
                      <label className="label">
                        <div className={'label-text'}>
                          {card.name}
                          {card.date != undefined ? (
                            <span>
                              {' '}
                              - (
                              {new Date().toISOString().split('T')[0] == new Date(card.date).toISOString().split('T')[0]
                                ? 'Heute'
                                : new Date(card.date).toLocaleDateString('de')}
                              )
                            </span>
                          ) : (
                            ''
                          )}
                        </div>
                        <input
                          name={'card-radio'}
                          type={'radio'}
                          className={'radio'}
                          value={card.id}
                          checked={selectedCard?.id == card.id}
                          onChange={() => {}}
                          onClick={() => {
                            setSelectedCardId(card.id);
                            router.replace('/', { query: { card: card.id } });
                          }}
                        />
                      </label>
                    </div>
                  ))
                )}
              </div>
              <div className={'divider'}>Anzeige</div>
              <div className="form-control">
                <label className="label">
                  Bilder anzeigen
                  <input
                    type={'checkbox'}
                    className={'toggle toggle-primary'}
                    defaultChecked={showImage}
                    onClick={() => setShowImage(!showImage)}
                  />
                </label>
              </div>
              <div className="form-control">
                <label className="label">
                  Tags anzeigen
                  <input
                    type={'checkbox'}
                    className={'toggle toggle-primary'}
                    defaultChecked={showTags}
                    onClick={() => setShowTags(!showTags)}
                  />
                </label>
              </div>
              <label className={'label'}>
                <div className={'label-text'}>Hell</div>
                <input
                  className={'toggle'}
                  type={'checkbox'}
                  data-toggle-theme="bumblebee,halloween"
                  data-act-class="toggle-primary"
                ></input>
                <div className={'label-text'}>Dark</div>
              </label>
            </div>
          </div>
        </div>

        <div
          className={'btn btn-primary btn-square rounded-xl btn-lg'}
          onClick={() => modalContext.openModal(<SearchModal />)}
        >
          <FaSearch />
        </div>
        <Link href={'/manage'}>
          <div className={' btn btn-primary btn-square rounded-xl btn-lg'}>
            <BsFillGearFill />
          </div>
        </Link>
      </div>
    </div>
  );
}
