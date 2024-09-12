import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaArrowDown, FaCheck, FaEye, FaSearch, FaTimes } from 'react-icons/fa';
import Link from 'next/link';
import { BsFillGearFill } from 'react-icons/bs';
import { CocktailCardFull } from '../../../models/CocktailCardFull';
import CocktailRecipeCardItem from '../../../components/cocktails/CocktailRecipeCardItem';
import { CocktailCard, CocktailRecipe, Setting } from '@prisma/client';
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
import '../../../lib/DateUtils';
import { addCocktailToStatistic, removeCocktailFromQueue } from '../../../lib/network/cocktailTracking';
import { CocktailDetailModal } from '../../../components/modals/CocktailDetailModal';

export default function OverviewPage() {
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const router = useRouter();
  const { workspaceId } = router.query;

  // Set by user settings

  const [showImage, setShowImage] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [lessItems, setLessItems] = useState(false);
  const [showStatisticActions, setShowStatisticActions] = useState(false);
  const [showQueueAsOverlay, setShowQueueAsOverlay] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [cocktailCards, setCocktailCards] = useState<CocktailCardFull[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    const handleSearchShortCut = (event: any) => {
      if (event.shiftKey && event.key === 'F' && modalContext.content.length == 0) {
        if (!(document.querySelector('#globalModal') as any)?.checked) {
          modalContext.openModal(<SearchModal showStatisticActions={showStatisticActions} />);
        }
      }
    };
    window.addEventListener('keypress', handleSearchShortCut);

    return () => {
      window.removeEventListener('keypress', handleSearchShortCut);
    };
  }, [modalContext, showStatisticActions]);

  // fetch cards initially
  useEffect(() => {
    if (!workspaceId) return;
    setLoadingCards(true);
    fetch(`/api/workspaces/${workspaceId}/cards`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailCards(body.data);
        } else {
          console.error('CocktailCardPage -> fetchCards', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Karten', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CocktailCardPage -> fetchCards', error);
        alertService.error('Fehler beim Laden der Karten');
      })
      .finally(() => setLoadingCards(false));
  }, [userContext.user, workspaceId]);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(cocktailCards.length > 0 ? cocktailCards[0].id : undefined);
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(cocktailCards.length > 0 ? cocktailCards[0] : undefined);

  useEffect(() => {
    if (selectedCardId != undefined && selectedCardId != 'search') {
      setLoadingGroups(true);
      fetch(`/api/workspaces/${workspaceId}/cards/` + selectedCardId)
        .then(async (response) => {
          const body = await response.json();
          if (response.ok) {
            setSelectedCard(body.data);
          } else {
            console.error('CocktailCardPage -> fetchCard', response);
            alertService.error(body.message ?? 'Fehler beim Laden der Karte', response.status, response.statusText);
          }
        })
        .catch((error) => {
          console.error('CocktailCardPage -> fetchCard', error);
          alertService.error('Fehler beim Laden der Karte');
        })
        .finally(() => setLoadingGroups(false));
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

    if (new Date(a.date ?? new Date()).toISOString().slice(0, 10) > today && new Date(b.date ?? new Date()).toISOString().slice(0, 10) <= today) {
      return -1; // a (zukünftiges Datum) kommt vor b
    }
    if (new Date(a.date ?? new Date()).toISOString().slice(0, 10) <= today && new Date(b.date ?? new Date()).toISOString().slice(0, 10) > today) {
      return 1; // b (zukünftiges Datum) kommt vor a
    }

    return a.name.localeCompare(b.name);
  }, []);

  useEffect(() => {
    console.debug('selectedCardId', selectedCardId);
    if (selectedCardId == undefined && cocktailCards.length > 0) {
      const todayCardId = cocktailCards.filter((card) => card.date != undefined).find((card) => card.date?.withoutTime == new Date().withoutTime)?.id;

      console.debug(
        'cocktailCards',
        cocktailCards.map((c) => {
          return {
            name: c.name,
            date: c.date,
            dateWithoutTime: c.date?.withoutTime,
          };
        }),
      );

      const date = new Date();
      date.setHours(0, 0, 0, 0);
      console.debug('today-date', date.toISOString());
      console.debug('today-withouttime', new Date().withoutTime);

      console.debug('todayCardId', todayCardId);
      if (todayCardId) {
        setSelectedCardId(todayCardId);
        router
          .replace({
            pathname: '/workspaces/[workspaceId]',
            query: {
              card: todayCardId,
              workspaceId: workspaceId,
            },
          })
          .then();
      } else {
        setSelectedCardId(cocktailCards[0].id);
        router
          .replace({
            pathname: '/workspaces/[workspaceId]',
            query: {
              card: cocktailCards[0].id,
              workspaceId: workspaceId,
            },
          })
          .then();
      }
    }
  }, [cocktailCards, router, selectedCardId, sortCards, workspaceId]);

  useEffect(() => {
    setShowImage(userContext.user?.settings?.find((s) => s.setting == Setting.showImage)?.value == 'true' ?? false);
    setShowTags(userContext.user?.settings?.find((s) => s.setting == Setting.showTags)?.value == 'true' ?? false);
    setLessItems(userContext.user?.settings?.find((s) => s.setting == Setting.lessItems)?.value == 'true' ?? false);
    setShowStatisticActions(userContext.user?.settings?.find((s) => s.setting == Setting.showStatisticActions)?.value == 'true' ?? false);
    setShowQueueAsOverlay(userContext.user?.settings?.find((s) => s.setting == Setting.showQueueAsOverlay)?.value == 'true' ?? false);
    setShowDescription(userContext.user?.settings?.find((s) => s.setting == Setting.showDescription)?.value == 'true' ?? false);
    setShowNotes(userContext.user?.settings?.find((s) => s.setting == Setting.showNotes)?.value == 'true' ?? false);
    setShowTime(userContext.user?.settings?.find((s) => s.setting == Setting.showTime)?.value == 'true' ?? false);
  }, [userContext.user?.settings]);

  const [currentTime, setCurrentTime] = useState(new Date());

  const refreshQueue = useCallback(() => {
    fetch(`/api/workspaces/${workspaceId}/queue`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailQueue(body.data);
          console.debug('queue', body.data);
        } else {
          console.error('CocktailCardPage -> fetchQueue', response);
        }
      })
      .catch((error) => {
        console.error('CocktailCardPage -> fetchQueue', error);
      })
      .finally(() => {});
  }, [workspaceId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10 * 1000);
    return () => clearInterval(interval);
  }, []);

  interface CocktailQueueItem {
    cocktailRecipe: CocktailRecipe;
    count: number;
  }

  const [cocktailQueue, setCocktailQueue] = useState<CocktailQueueItem[]>([]);
  const [submittingQueue, setSubmittingQueue] = useState<{ cocktailId: string; mode: 'ACCEPT' | 'REJECT' }[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (showStatisticActions) {
      interval = setInterval(() => {
        refreshQueue();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [refreshQueue, showStatisticActions]);

  const [maxDropdownHeight, setMaxDropdownHeight] = useState(0);
  const actionButtonRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [isDropdownScrollable, setIsDropdownScrollable] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (dropdownRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = dropdownRef.current;
        setIsDropdownScrollable(scrollTop + clientHeight + 16 < scrollHeight);
      }
    };

    if (dropdownRef.current) {
      dropdownRef.current.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }

    return () => {
      if (dropdownRef.current) {
        dropdownRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });
  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (actionButtonRef.current) {
      const rect = actionButtonRef.current.getBoundingClientRect();
      const maxHeight = windowSize.height - (windowSize.height - rect.y) - (process.env.NODE_ENV == 'development' ? 40 : 0) - 8;
      setMaxDropdownHeight(maxHeight);
    }
  }, [windowSize]);

  const timeComponent = (
    <div className={'w-full text-center'}>
      {selectedCard && selectedCardId != 'search' ? (
        <span>
          Angezeigte Karte: <strong>{selectedCard.name}</strong> -{' '}
        </span>
      ) : (
        ''
      )}
      {currentTime?.toFormatDateString()}, {currentTime?.toFormatTimeString()} Uhr
    </div>
  );

  return (
    <>
      <Head>
        <title>{`${selectedCard?.name ?? 'Cocktailkarte'} - ${userContext.workspace?.name ?? 'Cocktailkarte'}`}</title>
      </Head>

      <div className={'static h-screen'}>
        {showTime ? <div className={'pt-2'}>{timeComponent}</div> : <></>}

        <div
          className={`grid grid-cols-1 gap-2 p-2 ${showQueueAsOverlay ? '' : showStatisticActions && cocktailQueue.length > 0 ? 'lg:grid-cols-6' : ''} print:grid-cols-5 print:overflow-clip print:p-0`}
        >
          {showStatisticActions && cocktailQueue.length > 0 ? (
            <div
              className={
                showQueueAsOverlay
                  ? `sticky right-0 z-10 col-span-5 flex w-full justify-end print:hidden ${process.env.NODE_ENV == 'development' ? 'md:top-12' : 'md:top-2'}`
                  : 'order-first col-span-5 w-full lg:order-last lg:col-span-1 print:hidden'
              }
            >
              <div className={`${showQueueAsOverlay ? 'bg-opacity-75 lg:max-w-60' : ''} flex w-full flex-col rounded-xl bg-base-300 p-2 print:hidden`}>
                <div className={'underline'}>Warteschlange (A-Z)</div>
                <div className={'flex flex-col divide-y'}>
                  {cocktailQueue
                    .sort((a, b) => a.cocktailRecipe.name.localeCompare(b.cocktailRecipe.name))
                    .map((cocktailQueueItem, index) => (
                      <div key={`cocktailQueue-item-${index}`} className={'flex w-full flex-row justify-between gap-2 pb-1 pt-1 lg:flex-col'}>
                        <div className={'flex flex-row items-center justify-between'}>
                          <div className={'flex flex-row items-center gap-1'}>
                            <strong>{cocktailQueueItem.count}x</strong> {cocktailQueueItem.cocktailRecipe.name}
                          </div>
                        </div>
                        <div className={'space between flex flex-row gap-2'}>
                          <div
                            className={'btn btn-square btn-outline btn-sm'}
                            onClick={() => modalContext.openModal(<CocktailDetailModal cocktailId={cocktailQueueItem.cocktailRecipe.id} />, true)}
                          >
                            <FaEye />
                          </div>
                          <div className={'join w-full'}>
                            <button
                              className={'btn btn-success join-item btn-sm flex-1'}
                              disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailRecipe.id)}
                              onClick={() =>
                                addCocktailToStatistic({
                                  workspaceId: router.query.workspaceId as string,
                                  cocktailId: cocktailQueueItem.cocktailRecipe.id,
                                  actionSource: 'QUEUE',
                                  setSubmitting: (submitting) => {
                                    if (submitting) {
                                      setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailRecipe.id, mode: 'ACCEPT' }]);
                                    } else {
                                      setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailRecipe.id));
                                    }
                                  },
                                  reload: () => {
                                    refreshQueue();
                                  },
                                })
                              }
                            >
                              <FaCheck />
                            </button>
                            <button
                              className={'btn btn-error join-item btn-sm flex-1'}
                              disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailRecipe.id)}
                              onClick={() =>
                                removeCocktailFromQueue({
                                  workspaceId: router.query.workspaceId as string,
                                  cocktailId: cocktailQueueItem.cocktailRecipe.id,
                                  setSubmitting: (submitting) => {
                                    if (submitting) {
                                      setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailRecipe.id, mode: 'REJECT' }]);
                                    } else {
                                      setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailRecipe.id));
                                    }
                                  },
                                  reload: () => {
                                    refreshQueue();
                                  },
                                })
                              }
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <></>
          )}

          <div className={`order-1 col-span-5 flex w-full flex-col space-y-2 overflow-y-auto rounded-xl`}>
            {selectedCardId == 'search' || selectedCardId == undefined ? (
              <SearchPage showImage={showImage} showTags={showTags} showStatisticActions={showStatisticActions} />
            ) : loadingGroups ? (
              <PageCenter>
                <Loading />
              </PageCenter>
            ) : (selectedCard?.groups ?? []).length == 0 ? (
              <PageCenter>
                <div className={'text-center'}>Keine Gruppen in der Karte vorhanden</div>
              </PageCenter>
            ) : (
              selectedCard?.groups
                ?.sort((a, b) => a.groupNumber - b.groupNumber)
                .map((group) => (
                  <div
                    key={`card-${selectedCard.id}-group-${group.id}`}
                    className={'collapse collapse-arrow rounded-xl border border-base-300 bg-base-200 p-1 print:p-1'}
                  >
                    <input type={'checkbox'} defaultChecked={true} />
                    <div className={'collapse-title text-center text-2xl font-bold'}>
                      {group.name}
                      {group.groupPrice != undefined ? ` - Special Preis: ${group.groupPrice}€` : ''}
                    </div>
                    <div className={'collapse-content'}>
                      <div
                        className={`grid ${lessItems ? '2xl:grid-cols-5' : '2xl:grid-cols-6'} ${lessItems ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} ${lessItems ? 'md:grid-cols-2' : 'md:grid-cols-3'} ${lessItems ? 'xs:grid-cols-1' : 'xs:grid-cols-2'} grid-cols-1 gap-2 p-1`}
                      >
                        {group.items.length == 0 ? (
                          <div className={'col-span-full text-center'}>Keine Einträge vorhanden</div>
                        ) : (
                          group.items
                            ?.sort((a, b) => a.itemNumber - b.itemNumber)
                            .map((groupItem, index) => {
                              if (groupItem.cocktailId != undefined) {
                                return (
                                  <CocktailRecipeCardItem
                                    key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}
                                    showImage={showImage}
                                    showTags={showTags}
                                    showInfo={true}
                                    showPrice={groupItem.specialPrice == undefined && group.groupPrice == undefined}
                                    specialPrice={groupItem.specialPrice ?? group.groupPrice ?? undefined}
                                    cocktailRecipe={groupItem.cocktailId}
                                    showStatisticActions={showStatisticActions}
                                    showDescription={showDescription}
                                    showNotes={showNotes}
                                  />
                                );
                              } else {
                                return (
                                  <div key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}>
                                    <Loading />
                                  </div>
                                );
                              }
                            })
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {showTime ? <div className={'pb-2'}>{timeComponent}</div> : <></>}

        <div ref={actionButtonRef} className={'fixed bottom-2 right-2 z-10 flex flex-col space-y-2 md:bottom-5 md:right-5 print:hidden'}>
          <div className="dropdown dropdown-end dropdown-top pt-2">
            <label tabIndex={0} className={'btn btn-square btn-primary rounded-xl md:btn-lg'}>
              <FaEye />
            </label>
            <div
              tabIndex={0}
              className={`dropdown-content h-min w-64 rounded-box bg-base-100 p-2 shadow`}
              style={{
                maxHeight: maxDropdownHeight + 'px',
              }}
            >
              <div
                ref={dropdownRef}
                className={'overflow-y-auto'}
                style={{
                  maxHeight: maxDropdownHeight - 16 + 'px',
                }}
              >
                <div className={'flex flex-col space-x-2'}>
                  <label className="label">
                    <div className={'label-text'}>Such Ansicht</div>
                    <input
                      name={'card-radio'}
                      type={'radio'}
                      className={'radio'}
                      value={'search'}
                      checked={selectedCardId == 'search' || selectedCardId == undefined}
                      readOnly={true}
                      onClick={() => {
                        setSelectedCardId('search');
                        router
                          .replace({
                            pathname: '/workspaces/[workspaceId]',
                            query: { card: 'search', workspaceId: workspaceId },
                          })
                          .then();
                      }}
                    />
                  </label>
                  <div className={'divider-sm'}>Karte(n)</div>
                  {loadingCards ? (
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
                              router
                                .replace({
                                  pathname: '/workspaces/[workspaceId]',
                                  query: { card: card.id, workspaceId: workspaceId },
                                })
                                .then();
                            }}
                          />
                        </label>
                      </div>
                    ))
                  )}

                  <div className={'divider'}>Darstellung</div>
                  <div className={'w-full pr-3'}>
                    <details className="collapse collapse-arrow max-w-full self-center justify-self-center border">
                      <summary className="collapse-title">Rezept</summary>
                      <div className="collapse-content">
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
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            Beschreibung anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showDescription}
                              readOnly={true}
                              onClick={() => {
                                userContext.updateUserSetting(Setting.showDescription, !showDescription ? 'true' : 'false');
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            Notizen anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showNotes}
                              readOnly={true}
                              onClick={() => {
                                userContext.updateUserSetting(Setting.showNotes, !showNotes ? 'true' : 'false');
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            Tracking aktivieren
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showStatisticActions}
                              readOnly={true}
                              onClick={() => {
                                userContext.updateUserSetting(Setting.showStatisticActions, !showStatisticActions ? 'true' : 'false');
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className={'h-2'}></div>
                  <div className={'w-full pr-3'}>
                    <details className="collapse collapse-arrow max-w-full self-center justify-self-center border">
                      <summary className="collapse-title">Layout</summary>
                      <div className="collapse-content">
                        <div className="form-control">
                          <label className="label">
                            Uhrzeit anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showTime}
                              readOnly={true}
                              onClick={() => {
                                userContext.updateUserSetting(Setting.showTime, !showTime ? 'true' : 'false');
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
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            Warteschlange als Overlay
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showQueueAsOverlay}
                              readOnly={true}
                              onClick={() => {
                                userContext.updateUserSetting(Setting.showQueueAsOverlay, !showQueueAsOverlay ? 'true' : 'false');
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </details>
                  </div>
                  <div className={'h-2'}></div>
                  <ThemeChanger />
                </div>
              </div>
              {isDropdownScrollable && (
                <div className="absolute bottom-0 left-0 flex w-full justify-center pb-2">
                  <FaArrowDown className="animate-bounce" />
                </div>
              )}
            </div>
          </div>

          <>
            {selectedCardId != 'search' && selectedCardId != undefined ? (
              <div className={'tooltip'} data-tip={'Suche (Shift + F)'}>
                <div
                  className={'btn btn-square btn-primary rounded-xl md:btn-lg'}
                  onClick={() => modalContext.openModal(<SearchModal showStatisticActions={showStatisticActions} />)}
                >
                  <FaSearch />
                </div>
              </div>
            ) : (
              <></>
            )}
          </>
          <Link href={`/workspaces/${workspaceId}/manage`}>
            <div className={'btn btn-square btn-primary rounded-xl md:btn-lg'}>
              <BsFillGearFill />
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
