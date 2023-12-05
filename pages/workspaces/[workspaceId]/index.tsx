import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaEye, FaSearch } from 'react-icons/fa';
import Link from 'next/link';
import { BsFillGearFill } from 'react-icons/bs';
import { CocktailCardFull } from '../../../models/CocktailCardFull';
import CocktailRecipeOverviewItem from '../../../components/cocktails/CocktailRecipeOverviewItem';
import { CocktailCard, Setting } from '@prisma/client';
import { useRouter } from 'next/router';
import { ModalContext } from '../../../lib/context/ModalContextProvider';
import { SearchModal } from '../../../components/modals/SearchModal';
import { Loading } from '../../../components/Loading';
import { PageCenter } from '../../../components/layout/PageCenter';
import { alertService } from '../../../lib/alertService';
import ThemeChanger from '../../../components/ThemeChanger';
import Head from 'next/head';
import { UserContext } from '../../../lib/context/UserContextProvider';
import SearchPage from './search';

export default function OverviewPage() {
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const router = useRouter();
  const { workspaceId } = router.query;

  const [showImage, setShowImage] = useState(false);
  const [showImageSide, setShowImageSide] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [lessItems, setLessItems] = useState(false);

  const [cocktailCards, setCocktailCards] = useState<CocktailCardFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/cards`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailCards(body.data);
          if (body.data.length === 0) {
            setLoading(false);
          }
        } else {
          console.log('WorkspaceIndex -> fetchCards', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error(error);
        alertService.error(error.message);
      });
  }, [userContext.user, workspaceId]);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(
    cocktailCards.length > 0 ? cocktailCards[0].id : undefined,
  );
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(
    cocktailCards.length > 0 ? cocktailCards[0] : undefined,
  );

  useEffect(() => {
    if (selectedCardId != undefined) {
      setLoading(true);
      fetch(`/api/workspaces/${workspaceId}/cards/` + selectedCardId)
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error('Error while loading data');
          }
        })
        .then((json) => setSelectedCard(json.data))
        .catch((error) => {
          console.error(error);
          alertService.error(error.message);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedCardId, workspaceId]);

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
    if (selectedCardId == undefined && cocktailCards.length > 0) {
      setSelectedCardId(cocktailCards.sort(sortCards)[0].id);
      router
        .replace({
          pathname: '/workspaces/[workspaceId]',
          query: {
            card: cocktailCards[0].id,
            workspaceId: workspaceId,
          },
        })
        .then();
    } else {
      setSelectedCardId('search');
    }
  }, [cocktailCards, router, selectedCardId, sortCards, workspaceId]);

  useEffect(() => {
    setShowImage(userContext.user?.settings?.find((s) => s.setting == Setting.showImage)?.value == 'true' ?? false);
    setShowImageSide(
      userContext.user?.settings?.find((s) => s.setting == Setting.showImageSide)?.value == 'true' ?? false,
    );
    setShowTags(userContext.user?.settings?.find((s) => s.setting == Setting.showTags)?.value == 'true' ?? false);
    setLessItems(userContext.user?.settings?.find((s) => s.setting == Setting.lessItems)?.value == 'true' ?? false);
  }, [userContext.user?.settings]);

  return (
    <>
      <Head>
        <title>{`${selectedCard?.name ?? 'Cocktailkarte'} - ${userContext.workspace?.name ?? 'Cocktailkarte'}`}</title>
      </Head>

      <div className={'static h-screen'}>
        <div className={''}>
          <div
            className={'flex flex-col space-y-2 overflow-y-auto rounded-xl p-0 md:p-2 print:overflow-clip print:p-0'}
          >
            {loading ? (
              <PageCenter>
                <Loading />
              </PageCenter>
            ) : selectedCardId == 'search' ? (
              <SearchPage />
            ) : (selectedCard?.groups ?? []).length == 0 ? (
              <PageCenter>
                <div className={'text-center'}>Keine Karte gefunden</div>
              </PageCenter>
            ) : (
              selectedCard?.groups
                ?.sort((a, b) => a.groupNumber - b.groupNumber)
                .map((group) => (
                  <div
                    key={`card-${selectedCard.id}-group-${group.id}`}
                    className={'rounded-none p-1 md:rounded-xl md:border md:border-base-200 print:p-1'}
                  >
                    <div className={'p-2 text-center text-2xl font-bold'}>
                      {group.name}
                      {group.groupPrice != undefined ? ` - Special Preis: ${group.groupPrice}€` : ''}
                    </div>
                    <div
                      className={`grid 
                      ${lessItems ? '2xl:grid-cols-5 ' : '2xl:grid-cols-6 '}
                      ${lessItems ? 'xl:grid-cols-3 ' : 'xl:grid-cols-4 '}
                      ${lessItems ? 'md:grid-cols-2 ' : 'md:grid-cols-3 '}
                      ${lessItems ? 'xs:grid-cols-1 ' : ' xs:grid-cols-2 '}
                       grid-cols-1
                       gap-2 p-1 md:p-2`}
                    >
                      {group.items.length == 0 ? (
                        <div className={'col-span-full text-center'}>Keine Einträge vorhanden</div>
                      ) : (
                        group.items
                          ?.sort((a, b) => a.itemNumber - b.itemNumber)
                          .map((groupItem, index) => {
                            if (groupItem.cocktail != undefined) {
                              return (
                                <CocktailRecipeOverviewItem
                                  key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}
                                  showImage={showImage}
                                  showImageSide={showImageSide}
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
                          })
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className={'fixed bottom-2 right-2 flex flex-col space-y-2 md:bottom-5 md:right-5 print:hidden'}>
          <div className="dropdown dropdown-end dropdown-top pt-2">
            <label tabIndex={0} className={'btn btn-square btn-primary rounded-xl md:btn-lg'}>
              <FaEye />
            </label>
            <div tabIndex={0} className="dropdown-content w-52 rounded-box bg-base-100 p-2 shadow">
              <div className={'flex flex-col space-x-2'}>
                <div className={'divider'}>Karte</div>
                {loading ? (
                  <Loading />
                ) : cocktailCards.length == 0 ? (
                  <div>Keine Karten vorhanden</div>
                ) : (
                  cocktailCards.sort(sortCards).map((card) => (
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
                          readOnly={true}
                          onClick={() => {
                            setSelectedCardId(card.id);
                            router.replace({
                              pathname: '/workspaces/[workspaceId]',
                              query: { card: card.id, workspaceId: workspaceId },
                            });
                          }}
                        />
                      </label>
                    </div>
                  ))
                )}

                <div className={'divider'}>Anzeige</div>
                <label className="label">
                  <div className={'label-text'}>Suche</div>
                  <input
                    name={'card-radio'}
                    type={'radio'}
                    className={'radio'}
                    value={'search'}
                    checked={selectedCardId == 'search'}
                    readOnly={true}
                    onClick={() => {
                      setSelectedCardId('search');
                      router.replace({
                        pathname: '/workspaces/[workspaceId]',
                        query: { card: 'search', workspaceId: workspaceId },
                      });
                    }}
                  />
                </label>
                <div className="form-control">
                  <label className="label">
                    Bilder anzeigen
                    <input
                      type={'checkbox'}
                      className={'toggle toggle-primary'}
                      checked={showImage}
                      readOnly={true}
                      onClick={() => {
                        userContext.updateUserSetting(Setting.showImage, !showImage ? 'true' : 'false');
                        setShowImage(!showImage);
                      }}
                    />
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    Bilder seitlich
                    <input
                      type={'checkbox'}
                      className={'toggle toggle-primary'}
                      checked={showImageSide}
                      readOnly={true}
                      onClick={() => {
                        userContext.updateUserSetting(Setting.showImageSide, !showImageSide ? 'true' : 'false');
                        setShowImageSide(!showImage);
                      }}
                    />
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    Tags anzeigen
                    <input
                      type={'checkbox'}
                      className={'toggle toggle-primary'}
                      checked={showTags}
                      readOnly={true}
                      onClick={() => {
                        userContext.updateUserSetting(Setting.showTags, !showTags ? 'true' : 'false');
                        setShowTags(!showTags);
                      }}
                    />
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    Weniger Spalten
                    <input
                      type={'checkbox'}
                      className={'toggle toggle-primary'}
                      checked={lessItems}
                      readOnly={true}
                      onClick={() => {
                        userContext.updateUserSetting(Setting.lessItems, !lessItems ? 'true' : 'false');
                        setLessItems(!lessItems);
                      }}
                    />
                  </label>
                </div>
                <ThemeChanger />
              </div>
            </div>
          </div>

          <>
            {selectedCardId != 'search' ? (
              <div
                className={'btn btn-square btn-primary rounded-xl md:btn-lg'}
                onClick={() => modalContext.openModal(<SearchModal />)}
              >
                <FaSearch />
              </div>
            ) : (
              <></>
            )}
          </>
          <Link href={`/workspaces/${workspaceId}/manage`}>
            <div className={' btn btn-square btn-primary rounded-xl md:btn-lg'}>
              <BsFillGearFill />
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
