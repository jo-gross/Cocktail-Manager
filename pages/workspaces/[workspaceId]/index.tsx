import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FaAngleDown, FaAngleUp, FaArrowDown, FaCheck, FaEye, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import Link from 'next/link';
import { BsFillGearFill } from 'react-icons/bs';
import { CocktailCardFull } from '../../../models/CocktailCardFull';
import CocktailRecipeCardItem, { CocktailRecipeOverviewItemRef } from '../../../components/cocktails/CocktailRecipeCardItem';
import { CocktailCard, Setting } from '@generated/prisma/client';
import { useRouter } from 'next/router';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { SearchModal, SearchModalRef } from '@components/modals/SearchModal';
import { Loading } from '@components/Loading';
import ThemeChanger from '../../../components/ThemeChanger';
import Head from 'next/head';
import { UserContext } from '@lib/context/UserContextProvider';
import '../../../lib/DateUtils';
import { addCocktailToStatistic, changeQueueProcess, removeCocktailFromQueue } from '@lib/network/cocktailTracking';
import { CocktailDetailModal } from '@components/modals/CocktailDetailModal';
import _ from 'lodash';
import { FaArrowTurnDown, FaArrowTurnUp } from 'react-icons/fa6';
import '../../../lib/ArrayUtils';
import { CgArrowsExpandUpLeft } from 'react-icons/cg';
import { PageCenter } from '@components/layout/PageCenter';
import { NextPageWithPullToRefresh } from '../../../types/next';
import { OrderView } from '../../../components/order/OrderView';
import { useOffline } from '@lib/context/OfflineContextProvider';
import { fetchCards, fetchCard, prefetchCardData } from '@lib/network/cards';
import { prefetchAllCocktails } from '@lib/network/cocktails';

const OverviewPage: NextPageWithPullToRefresh = () => {
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const { isOnline, isOfflineMode } = useOffline();
  const router = useRouter();
  const { workspaceId } = router.query;

  // Effective offline state - true when network is unavailable or manually in offline mode
  const isOffline = !isOnline || isOfflineMode;

  // Set by user settings

  const [showImage, setShowImage] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [lessItems, setLessItems] = useState(false);
  const [showStatisticActions, setShowStatisticActions] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [queueGrouping, setQueueGrouping] = useState<'ALPHABETIC' | 'NONE'>('NONE');
  const [showFastQueueCheck, setShowFastQueueCheck] = useState(false);
  const [showSettingsAtBottom, setShowSettingsAtBottom] = useState(false);

  const [cocktailCards, setCocktailCards] = useState<CocktailCardFull[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [selectedCocktail, setSelectedCocktail] = useState<string | undefined>(undefined);

  // Search modal shortcut (Shift + F)
  useEffect(() => {
    const handleSearchShortCut = (event: any) => {
      if (event.shiftKey && event.key === 'F' && modalContext.content.length == 0) {
        // Prüfe, ob der Fokus auf einem Input-Element liegt
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            (activeElement as HTMLElement).isContentEditable);

        if (!isInputFocused && !(document.querySelector('#globalModal') as any)?.checked) {
          modalContext.openModal(<SearchModal showStatisticActions={showStatisticActions} />);
        }
      }
    };
    window.addEventListener('keypress', handleSearchShortCut);

    return () => {
      window.removeEventListener('keypress', handleSearchShortCut);
    };
  }, [modalContext, showStatisticActions]);

  // fetch cards initially with cache support
  useEffect(() => {
    if (!workspaceId) return;
    fetchCards(workspaceId as string, setCocktailCards, setLoadingCards);
  }, [userContext.user, workspaceId]);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>((router.query.card as string) || undefined);
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(cocktailCards.length > 0 ? cocktailCards[0] : undefined);

  const fetchSelectedCard = useCallback(() => {
    if (selectedCardId != undefined && selectedCardId != 'search' && selectedCardId != 'order' && workspaceId) {
      fetchCard(workspaceId as string, selectedCardId, setSelectedCard, setLoadingGroups);
    }
  }, [selectedCardId, workspaceId]);

  useEffect(() => {
    fetchSelectedCard();
  }, [fetchSelectedCard]);

  // Prefetch card data for offline use when a card is loaded
  useEffect(() => {
    if (selectedCard && workspaceId && isOnline) {
      // Prefetch in background without blocking UI
      prefetchCardData(workspaceId as string, selectedCard).catch(console.error);
      // Also prefetch all cocktails for search
      prefetchAllCocktails(workspaceId as string).catch(console.error);
    }
  }, [selectedCard, workspaceId, isOnline]);

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
    // Initialize selectedCardId from router query if available
    if (router.query.card && router.query.card !== selectedCardId) {
      setSelectedCardId(router.query.card as string);
    }
  }, [router.query.card]);

  useEffect(() => {
    if (selectedCardId == undefined && cocktailCards.length > 0 && router.query.card != 'search' && router.query.card != 'order') {
      const todayCardId = cocktailCards
        .filter((card) => card.date != undefined)
        .find((card) => new Date(card.date!).toISOString().split('T')[0] == new Date().toISOString().split('T')[0])?.id;

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
    setShowImage(userContext.user?.settings?.find((s) => s.setting == Setting.showImage)?.value == 'true');
    setShowTags(userContext.user?.settings?.find((s) => s.setting == Setting.showTags)?.value == 'true');
    setLessItems(userContext.user?.settings?.find((s) => s.setting == Setting.lessItems)?.value == 'true');
    setShowStatisticActions(userContext.user?.settings?.find((s) => s.setting == Setting.showStatisticActions)?.value == 'true');
    setShowDescription(userContext.user?.settings?.find((s) => s.setting == Setting.showDescription)?.value == 'true');
    setShowNotes(userContext.user?.settings?.find((s) => s.setting == Setting.showNotes)?.value == 'true');
    setShowHistory(userContext.user?.settings?.find((s) => s.setting == Setting.showHistory)?.value == 'true');
    setShowTime(userContext.user?.settings?.find((s) => s.setting == Setting.showTime)?.value == 'true');
    setShowRating(userContext.user?.settings?.find((s) => s.setting == Setting.showRating)?.value == 'true');
    setQueueGrouping(userContext.user?.settings?.find((s) => s.setting == Setting.queueGrouping)?.value as 'ALPHABETIC' | 'NONE');
    setShowFastQueueCheck(userContext.user?.settings?.find((s) => s.setting == Setting.showFastQueueCheck)?.value == 'true');
    setShowSettingsAtBottom(userContext.user?.settings?.find((s) => s.setting == Setting.showSettingsAtBottom)?.value == 'true');
  }, [userContext.user?.settings]);

  // ========================
  // Clock
  // ========================

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ========================
  // Queue
  // ========================

  const refreshQueue = useCallback(() => {
    fetch(`/api/workspaces/${workspaceId}/queue?timestamp=${new Date().toISOString()}`)
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

  interface CocktailQueueItem {
    queueItemId: string;
    cocktailId: string;
    timestamp: Date;
    cocktailName: string;
    inProgress: boolean;
    notes?: string;
  }

  interface GroupedItem {
    queueItemId: string;
    cocktailId: string;
    notes: string | undefined;
    cocktailName: string;
    count: number;
    oldestTimestamp: Date;
    inProgress?: boolean;
    total: number | undefined;
  }

  const [cocktailQueue, setCocktailQueue] = useState<CocktailQueueItem[]>([]);
  const [submittingQueue, setSubmittingQueue] = useState<{ cocktailId: string; mode: 'ACCEPT' | 'REJECT' | 'IN_PROGRESS' | 'NOT_ANYMORE_IN_PROGRESS' }[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    // Only refresh queue when online and statistic actions are enabled
    if (showStatisticActions && !isOffline) {
      interval = setInterval(() => {
        refreshQueue();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [refreshQueue, showStatisticActions, isOffline]);

  const dropdownContentRef = React.useRef<HTMLDivElement>(null);
  const [isDropdownScrollable, setIsDropdownScrollable] = useState(false);

  const [showRecipeOptions, setShowRecipeOptions] = useState(false);
  const [showQueueOptions, setShowQueueOptions] = useState(false);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);

  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  /* ───── Click‑Outside Detection ───── */
  useEffect(() => {
    if (!isMenuExpanded) return;

    function handleOutside(e: MouseEvent) {
      if (actionButtonRef.current && !actionButtonRef.current.contains(e.target as Node)) {
        setIsMenuExpanded(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMenuExpanded]);

  const checkDropdownScroll = useCallback(() => {
    const handleScroll = () => {
      if (dropdownContentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = dropdownContentRef.current;
        setIsDropdownScrollable(scrollTop + clientHeight + 16 < scrollHeight);
      }
    };

    if (dropdownContentRef.current) {
      dropdownContentRef.current.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }

    return () => {
      if (dropdownContentRef.current) {
        dropdownContentRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    checkDropdownScroll();
  }, []);

  useEffect(() => {
    checkDropdownScroll();
  }, [checkDropdownScroll, showLayoutOptions, showRecipeOptions, showSettingsAtBottom, showTime]);

  const [maxDropdownHeight, setMaxDropdownHeight] = useState(0);
  const actionButtonRef = useRef<HTMLDivElement>(null);

  const [windowHeight, setWindowHeight] = useState<number>(0);

  useEffect(() => {
    function handleResize() {
      setWindowHeight(window.innerHeight);
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calcMaxDropdownHeight = useCallback(() => {
    if (actionButtonRef.current && windowHeight > 0) {
      const rect = actionButtonRef.current.getBoundingClientRect();
      if (showSettingsAtBottom) {
        setMaxDropdownHeight(rect.top - (process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 40 : 0) - 8);
      } else {
        const maxHeight = windowHeight - (windowHeight - rect.y) - (process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 40 : 0) - 8;
        setMaxDropdownHeight(maxHeight);
      }
    }
  }, [windowHeight, showSettingsAtBottom, isMenuExpanded]);

  useEffect(() => {
    calcMaxDropdownHeight();
  }, [calcMaxDropdownHeight, showSettingsAtBottom, showTime, selectedCard, isMenuExpanded]);

  const timeComponent = (
    <div className={'w-full text-center'}>
      {selectedCard && selectedCardId != 'search' ? (
        <span>
          <strong>{selectedCard.name}</strong> -{' '}
        </span>
      ) : (
        ''
      )}
      {currentTime?.toFormatDateTimeShort()} Uhr
    </div>
  );

  const cocktailItemRefs = useRef<{ [key: string]: CocktailRecipeOverviewItemRef | null }>({});

  // Function to refresh a specific CocktailRecipeCardItem
  const handleCocktailCardRefresh = useCallback((cocktailId: string) => {
    if (cocktailItemRefs.current[cocktailId]) {
      cocktailItemRefs.current[cocktailId]?.refresh();
    }
  }, []);

  const triggerAllCocktailCardRefresh = useCallback(() => {
    Object.keys(cocktailItemRefs.current).forEach((cocktailId) => {
      if (cocktailItemRefs.current[cocktailId]) {
        cocktailItemRefs.current[cocktailId]?.recalculateClamp();
      }
    });
  }, []);
  useEffect(() => {
    triggerAllCocktailCardRefresh();
  }, [lessItems]);

  const searchPageSearchRef = useRef<SearchModalRef>(null);
  const selectedCocktailItemCardRef = useRef<CocktailRecipeOverviewItemRef>(null);

  OverviewPage.pullToRefresh = async () => {
    // Only refresh queue when online
    if (!isOffline) {
      refreshQueue();
    }
    if (selectedCardId != 'search' && selectedCardId != undefined) {
      fetchSelectedCard();
    } else {
      if (searchPageSearchRef.current) {
        await searchPageSearchRef.current.refresh(selectedCocktail);
      }
      if (selectedCocktailItemCardRef.current) {
        selectedCocktailItemCardRef.current.refresh();
      }
    }
  };

  function renderCocktailQueueItem(cocktailQueueItem: GroupedItem, index: number) {
    return (
      <div key={`cocktailQueue-item-${index}`} className={'flex w-full flex-row flex-wrap justify-between gap-2 pb-1 pt-1 lg:flex-col'}>
        <div
          className={'cursor-pointer'}
          onClick={() => {
            if (selectedCardId == 'search' || selectedCardId == undefined) {
              setSelectedCocktail(cocktailQueueItem.cocktailId);
            } else {
              modalContext.openModal(
                <CocktailDetailModal
                  cocktailId={cocktailQueueItem.cocktailId}
                  onRefreshRatings={() => handleCocktailCardRefresh(cocktailQueueItem.cocktailName)}
                  queueNotes={cocktailQueueItem.notes}
                  queueAmount={cocktailQueueItem.count}
                  openReferer={'QUEUE'}
                />,
                true,
              );
            }
          }}
        >
          <div className={'mt-1 flex flex-row flex-wrap items-center justify-between gap-1'}>
            <div className={'font-bold'}>
              <strong>{cocktailQueueItem.count}x</strong> {cocktailQueueItem.cocktailName}{' '}
            </div>
            <span className={'flex flex-wrap gap-1'}>{cocktailQueueItem.notes && <span className={'italic'}>mit Notiz</span>}</span>
          </div>
          <div className={'flex flex-row flex-wrap items-center justify-between gap-1'}>
            {cocktailQueueItem.total != undefined && cocktailQueueItem.total > 1 ? (
              <span className={'font-thin'}> (Insg. {cocktailQueueItem.total} gleiche)</span>
            ) : (
              <></>
            )}
            <span>(seit {new Date(cocktailQueueItem?.oldestTimestamp).toFormatTimeString()} Uhr)</span>
          </div>
          {cocktailQueueItem.notes && <span className={'long-text-format italic lg:pb-1'}>Notiz: {cocktailQueueItem.notes}</span>}
        </div>
        <div className={'flex w-full flex-row gap-2 pb-1'}>
          <div
            className={'btn btn-square btn-outline btn-sm'}
            onClick={() =>
              modalContext.openModal(
                <CocktailDetailModal
                  cocktailId={cocktailQueueItem.cocktailId}
                  onRefreshRatings={() => handleCocktailCardRefresh(cocktailQueueItem.cocktailName)}
                  queueNotes={cocktailQueueItem.notes}
                  queueAmount={cocktailQueueItem.count}
                  openReferer={'QUEUE'}
                />,
                true,
              )
            }
          >
            <FaEye />
          </div>
          <div className={'join grid w-full grid-cols-3'}>
            {(cocktailQueueItem.inProgress || showFastQueueCheck) && (
              <button
                className={`btn btn-success join-item btn-sm ${showFastQueueCheck && !cocktailQueueItem.inProgress ? '' : 'col-span-2'}`}
                disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId)}
                onClick={() =>
                  addCocktailToStatistic({
                    workspaceId: router.query.workspaceId as string,
                    cocktailId: cocktailQueueItem.cocktailId,
                    actionSource: 'QUEUE',
                    notes: cocktailQueueItem.notes ?? '-',
                    setSubmitting: (submitting) => {
                      if (submitting) {
                        setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailId, mode: 'ACCEPT' }]);
                      } else {
                        setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailId));
                      }
                    },
                    onSuccess: () => {
                      refreshQueue();
                    },
                  })
                }
              >
                {submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId && i.mode == 'ACCEPT') && (
                  <span className={'loading loading-spinner'} />
                )}
                <FaCheck />
              </button>
            )}
            {!cocktailQueueItem.inProgress && (
              <button
                className={`btn ${showFastQueueCheck ? '' : 'col-span-2'} btn-info join-item btn-sm`}
                disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId)}
                onClick={() =>
                  changeQueueProcess({
                    workspaceId: router.query.workspaceId as string,
                    cocktailQueueItemId: cocktailQueueItem.queueItemId,
                    inProgress: true,
                    setSubmitting: (submitting) => {
                      if (submitting) {
                        setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailId, mode: 'IN_PROGRESS' }]);
                      } else {
                        setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailId));
                      }
                    },
                    onSuccess: () => {
                      refreshQueue();
                    },
                  })
                }
              >
                {submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId && i.mode == 'IN_PROGRESS') && (
                  <span className={'loading loading-spinner'} />
                )}
                <FaArrowTurnUp />
              </button>
            )}
            {cocktailQueueItem.inProgress ? (
              <button
                className={'btn btn-error join-item btn-sm'}
                disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId)}
                onClick={() =>
                  changeQueueProcess({
                    workspaceId: router.query.workspaceId as string,
                    cocktailQueueItemId: cocktailQueueItem.queueItemId,
                    inProgress: false,
                    setSubmitting: (submitting) => {
                      if (submitting) {
                        setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailId, mode: 'NOT_ANYMORE_IN_PROGRESS' }]);
                      } else {
                        setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailId));
                      }
                    },
                    onSuccess: () => {
                      refreshQueue();
                    },
                  })
                }
              >
                {submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId && i.mode == 'NOT_ANYMORE_IN_PROGRESS') && (
                  <span className={'loading loading-spinner'} />
                )}
                <FaArrowTurnDown />
              </button>
            ) : (
              <button
                className={'btn btn-error join-item btn-sm'}
                disabled={!!submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId)}
                onClick={() =>
                  removeCocktailFromQueue({
                    workspaceId: router.query.workspaceId as string,
                    cocktailId: cocktailQueueItem.cocktailId,
                    notes: cocktailQueueItem.notes,
                    setSubmitting: (submitting) => {
                      if (submitting) {
                        setSubmittingQueue([...submittingQueue, { cocktailId: cocktailQueueItem.cocktailId, mode: 'REJECT' }]);
                      } else {
                        setSubmittingQueue(submittingQueue.filter((i) => i.cocktailId != cocktailQueueItem.cocktailId));
                      }
                    },
                    reload: () => {
                      refreshQueue();
                    },
                  })
                }
              >
                {submittingQueue.find((i) => i.cocktailId == cocktailQueueItem.cocktailId && i.mode == 'REJECT') && (
                  <span className={'loading loading-spinner'} />
                )}
                <FaTimes />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>The Cocktail-Manager • {selectedCard?.name ?? 'Cocktailkarte'}</title>
      </Head>

      <div className={'static min-h-screen'}>
        <div
          className={`grid grid-cols-1 gap-2 p-2 ${showStatisticActions && cocktailQueue.length > 0 && !isOffline ? 'lg:grid-cols-8 xl:grid-cols-6' : ''} print:grid-cols-5 print:overflow-clip print:p-0`}
        >
          {showStatisticActions && cocktailQueue.length > 0 && !isOffline ? (
            <aside
              className={`sticky order-first col-span-5 flex w-full flex-col rounded-xl bg-base-300 p-2 pb-0 lg:order-last lg:col-span-2 xl:col-span-1 print:hidden ${process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 'md:top-12' : 'md:top-2'} h-fit ${process.env.NODE_ENV == 'development' || process.env.DEPLOYMENT == 'staging' ? 'max-h-[calc(100vh-3.5rem)]' : 'max-h-[calc(100vh-1rem)]'}`}
            >
              {showTime ? <div className={'pb-2'}>{timeComponent}</div> : <></>}
              <div className="flex w-full flex-row flex-wrap items-center justify-center border-b border-base-content pb-1 text-center">
                <span className="truncate">Wird gemacht</span>
                <span className="ml-1">(A-Z)</span>
              </div>

              {/*<div className={'divider'}></div>*/}
              <div className={'max-h-1/3 flex flex-col divide-y overflow-y-auto border-b border-base-content'}>
                {(queueGrouping == 'ALPHABETIC' || true
                  ? _(cocktailQueue)
                      .filter((item) => item.inProgress)
                      .groupBy((item) => `${item.cocktailId}||${item.notes}`) // Gruppierung basierend auf cocktailId und notes
                      .map((items, key) => {
                        const [cocktailId, notes] = key.split('||'); // Extrahiere cocktailId und notes aus dem Key
                        return {
                          queueItemId: items[0].queueItemId,
                          cocktailId: cocktailId,
                          notes: notes === 'null' || notes === '' ? undefined : notes,
                          cocktailName: items[0].cocktailName,
                          count: items.length,
                          oldestTimestamp: _.minBy(items, 'timestamp')!.timestamp, // Finde den ältesten Timestamp
                          inProgress: true,
                          total: undefined,
                        };
                      })
                      .sortBy(['cocktailName', (item) => -(item.notes ?? '')]) // Sortiere nach cocktailName (asc) und notes (desc)
                  : _(cocktailQueue)
                      .filter((item) => item.inProgress)
                      .sortBy('timestamp') // Sortiere nach timestamp (desc)
                      .map((item, key) => {
                        return {
                          queueItemId: item.queueItemId,
                          cocktailId: item.cocktailId,
                          notes: item.notes,
                          cocktailName: item.cocktailName,
                          count: 1,
                          oldestTimestamp: item.timestamp,
                          inProgress: true,
                          total: cocktailQueue.filter((i) => i.cocktailId == item.cocktailId && i.notes == item.notes).length,
                        };
                      })
                )
                  .value()
                  .mapWithFallback(
                    (cocktailQueueItem, index) => renderCocktailQueueItem(cocktailQueueItem, index),
                    <div className={'w-full text-center font-thin italic'}>Keine Einträge</div>,
                  )}
              </div>
              <div className={'h-2'}></div>
              <div className="flex w-full flex-row flex-wrap items-center justify-center border-b border-base-content pb-1 text-center">
                <span className="truncate">Warteschlange</span>
                <span className="ml-1">({queueGrouping == 'ALPHABETIC' ? 'A-Z' : 'Uhr'})</span>
              </div>
              <div className={'flex flex-col divide-y overflow-y-auto'}>
                {(queueGrouping == 'ALPHABETIC'
                  ? _(cocktailQueue)
                      .filter((item) => !item.inProgress)
                      .groupBy((item) => `${item.cocktailId}||${item.notes || ''}`) // Gruppierung basierend auf cocktailId und notes
                      .map<GroupedItem>((items, key) => {
                        const [cocktailId, notes] = key.split('||'); // Extrahiere cocktailId und notes aus dem Key
                        return {
                          queueItemId: items[0].queueItemId,
                          cocktailId: cocktailId,
                          notes: notes === 'null' || notes === '' ? undefined : notes,
                          cocktailName: items[0].cocktailName,
                          count: items.length,
                          oldestTimestamp: _.minBy(items, 'timestamp')!.timestamp, // Finde den ältesten Timestamp
                          inProgress: false,
                          total: undefined,
                        };
                      })
                      .sortBy(['cocktailName', (item) => -(item.notes ?? '')])
                      .value()
                  : _(cocktailQueue)
                      .filter((item) => !item.inProgress)
                      .sortBy('timestamp') // Sortiere nach timestamp (desc)
                      .reduce<GroupedItem[]>((acc, item) => {
                        if (acc.length > 0 && acc[acc.length - 1].cocktailId === item.cocktailId && acc[acc.length - 1].notes === item.notes) {
                          acc[acc.length - 1].count += 1; // Erhöhe die Anzahl für zusammenhängende gleiche Einträge
                        } else {
                          acc.push({
                            queueItemId: item.queueItemId,
                            cocktailId: item.cocktailId,
                            notes: item.notes,
                            cocktailName: item.cocktailName,
                            count: 1,
                            oldestTimestamp: item.timestamp,
                            total: cocktailQueue.filter((i) => i.cocktailId == item.cocktailId && i.notes == item.notes).length,
                          });
                        }
                        return acc;
                      }, [])
                ).mapWithFallback((cocktailQueueItem, index) => renderCocktailQueueItem(cocktailQueueItem, index), <div>Warteschlange ist leer</div>)}
              </div>
            </aside>
          ) : (
            <></>
          )}

          <main className={`order-1 col-span-5 flex w-full flex-col space-y-2 overflow-y-auto rounded-xl lg:col-span-6 xl:col-span-5`}>
            {selectedCardId == 'order' ? (
              <OrderView cocktailCards={cocktailCards} workspaceId={workspaceId as string} />
            ) : selectedCardId == 'search' || selectedCardId == undefined ? (
              <div className={'flex flex-col-reverse gap-2 md:flex-row'}>
                <div className={'card w-full flex-1'}>
                  <div className={`card-body`}>
                    <SearchModal
                      ref={searchPageSearchRef}
                      onCocktailSelectedObject={(cocktail) => setSelectedCocktail(cocktail.id)}
                      selectionLabel={'Ansehen'}
                      showRecipe={false}
                      customWidthClassName={'w-full'}
                      notAsModal={true}
                    />
                  </div>
                </div>
                <div className={'h-min w-full flex-1'}>
                  {showTime && !showStatisticActions ? <div className={'w-full pb-2 text-center'}>{currentTime?.toFormatDateTimeShort()} Uhr</div> : <></>}

                  {selectedCocktail ? (
                    <CocktailRecipeCardItem
                      ref={selectedCocktailItemCardRef}
                      cocktailRecipe={selectedCocktail}
                      showImage={showImage}
                      showDetailsOnClick={true}
                      showPrice={true}
                      showDescription={showDescription}
                      showNotes={showNotes}
                      showTags={showTags}
                      showStatisticActions={showStatisticActions}
                      showRating={showRating}
                    />
                  ) : (
                    <></>
                  )}
                </div>
              </div>
            ) : (
              <div className="gap-1 md:gap-2 flex flex-col">
                {showTime && !showStatisticActions ? <div className={'pb-2'}>{timeComponent}</div> : <></>}
                {loadingGroups ? (
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
                        className={`collapse collapse-arrow rounded-xl border border-base-300 bg-base-200 p-1 print:p-1`}
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
                                        ref={(el) => {
                                          cocktailItemRefs.current[groupItem.cocktailId!] = el;
                                        }}
                                        showImage={showImage}
                                        showTags={showTags}
                                        showDetailsOnClick={true}
                                        showPrice={groupItem.specialPrice == undefined && group.groupPrice == undefined}
                                        specialPrice={groupItem.specialPrice ?? group.groupPrice ?? undefined}
                                        cocktailRecipe={groupItem.cocktailId}
                                        showStatisticActions={showStatisticActions}
                                        showDescription={showDescription}
                                        showNotes={showNotes}
                                        showHistory={showHistory}
                                        showRating={showRating}
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
            )}
          </main>
        </div>

        {!isMenuExpanded && !showSettingsAtBottom ? (
          <div className={'fixed bottom-2 right-2'}>
            <button
              type={'button'}
              className={'btn btn-square btn-primary btn-sm'}
              onClick={async () => {
                setIsMenuExpanded(true);
              }}
            >
              <CgArrowsExpandUpLeft />
            </button>
          </div>
        ) : (
          <div
            ref={actionButtonRef}
            className={
              'bottom-2 right-2 z-10 flex space-y-2 md:bottom-5 md:right-5 print:hidden' + (showSettingsAtBottom ? ' mx-2 justify-end' : ' fixed flex-col')
            }
          >
            <div className={'dropdown dropdown-end dropdown-top pt-2' + (showSettingsAtBottom ? ' mr-1' : '')}>
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
                  ref={dropdownContentRef}
                  className={'overflow-y-auto'}
                  style={{
                    maxHeight: maxDropdownHeight - 16 + 'px',
                  }}
                >
                  <div className={'flex flex-col gap-2'}>
                    <label className="label">
                      <div className={'label-text font-bold'}>Cocktailsuche</div>
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
                    <label className="label">
                      <div className={'label-text font-bold'}>Bestellen</div>
                      <input
                        name={'card-radio'}
                        type={'radio'}
                        className={'radio'}
                        value={'order'}
                        checked={selectedCardId == 'order'}
                        readOnly={true}
                        onClick={() => {
                          setSelectedCardId('order');
                          router
                            .replace({
                              pathname: '/workspaces/[workspaceId]',
                              query: { card: 'order', workspaceId: workspaceId },
                            })
                            .then();
                        }}
                      />
                    </label>
                    <div className={'divider'}>Karte(n)</div>
                    {loadingCards ? (
                      <Loading />
                    ) : cocktailCards.length == 0 ? (
                      <div className={'flex items-center justify-between'}>
                        <div>Keine Karten vorhanden</div>
                        <Link href={`/workspaces/${workspaceId}/manage/cards/create`} className={'btn btn-square btn-outline btn-sm'}>
                          <FaPlus />
                        </Link>
                      </div>
                    ) : (
                      cocktailCards.sort(sortCards).map((card) => (
                        <div key={'card-' + card.id} className="form-control">
                          <label className="label">
                            <div className={'label-text font-bold'}>
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
                              checked={selectedCardId === card.id}
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
                    <div className={`flex flex-col gap-2`}>
                      <div className={'flex cursor-pointer flex-row items-center justify-between'} onClick={() => setShowRecipeOptions(!showRecipeOptions)}>
                        <div className={'font-bold'}>Rezeptbereich</div>
                        <div>{showRecipeOptions ? <FaAngleUp /> : <FaAngleDown />}</div>
                      </div>
                      <div className={`flex flex-col gap-2 ${showRecipeOptions ? '' : 'hidden'}`}>
                        {isOffline && <span className="text-xs text-warning">Nicht verfügbar im Offline-Modus</span>}
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Bilder anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showImage}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showImage, !showImage ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Tags anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showTags}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showTags, !showTags ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Beschreibung anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showDescription}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showDescription, !showDescription ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Notizen anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showNotes}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showNotes, !showNotes ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Geschichte und Entstehung anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showHistory}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showHistory, !showHistory ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Bewertung anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showRating}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showRating, !showRating ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Tracking aktivieren
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showStatisticActions}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showStatisticActions, !showStatisticActions ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={'divider'}></div>

                    <div className={`flex flex-col gap-2`}>
                      <div className={'flex cursor-pointer flex-row items-center justify-between'} onClick={() => setShowQueueOptions(!showQueueOptions)}>
                        <div className={'font-bold'}>Warteschlange</div>
                        <div>{showQueueOptions ? <FaAngleUp /> : <FaAngleDown />}</div>
                      </div>
                      <div className={`flex flex-col gap-2 ${showQueueOptions ? '' : 'hidden'}`}>
                        {isOffline && <span className="text-xs text-warning">Nicht verfügbar im Offline-Modus</span>}
                        <div className="form-control">
                          <div className={`${isOffline ? 'opacity-50' : ''}`}>Gruppierung</div>
                          <div key={'grouping-alphabetic'} className="form-control">
                            <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                              <div className={'label-text'}>Cocktailname (A-Z)</div>
                              <input
                                name={'queue-radio'}
                                type={'radio'}
                                className={'radio'}
                                value={'ALPHABETIC'}
                                checked={queueGrouping == 'ALPHABETIC'}
                                readOnly={true}
                                disabled={isOffline}
                                onClick={() => {
                                  if (!isOffline) {
                                    setQueueGrouping('ALPHABETIC');
                                    userContext.updateUserSetting(Setting.queueGrouping, 'ALPHABETIC');
                                  }
                                }}
                              />
                            </label>
                            <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                              <div className={'label-text'}>Keine (Chronologisch)</div>
                              <input
                                name={'queue-radio'}
                                type={'radio'}
                                className={'radio'}
                                value={'NONE'}
                                checked={queueGrouping == 'NONE' || queueGrouping == undefined}
                                readOnly={true}
                                disabled={isOffline}
                                onClick={() => {
                                  if (!isOffline) {
                                    setQueueGrouping('NONE');
                                    userContext.updateUserSetting(Setting.queueGrouping, 'NONE');
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Schnelles abhaken anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showFastQueueCheck}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showFastQueueCheck, !showFastQueueCheck ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className={'divider'}></div>
                    <div className={`flex flex-col gap-2`}>
                      <div className={'flex cursor-pointer flex-row items-center justify-between'} onClick={() => setShowLayoutOptions(!showLayoutOptions)}>
                        <div className={'font-bold'}>Layout</div>
                        <div>{showLayoutOptions ? <FaAngleUp /> : <FaAngleDown />}</div>
                      </div>
                      <div className={`flex flex-col gap-2 ${showLayoutOptions ? '' : 'hidden'}`}>
                        {isOffline && <span className="text-xs text-warning">Nicht verfügbar im Offline-Modus</span>}
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Uhrzeit anzeigen
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showTime}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showTime, !showTime ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                        {router.query.card !== 'search' && (
                          <div className="form-control">
                            <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                              Weniger Spalten
                              <input
                                type={'checkbox'}
                                className={'toggle toggle-primary'}
                                checked={lessItems}
                                readOnly={true}
                                disabled={isOffline}
                                onClick={() => {
                                  if (!isOffline) {
                                    userContext.updateUserSetting(Setting.lessItems, !lessItems ? 'true' : 'false');
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                        <div className="form-control">
                          <label className={`label ${isOffline ? 'opacity-50' : ''}`}>
                            Einstellungen am Ende
                            <input
                              type={'checkbox'}
                              className={'toggle toggle-primary'}
                              checked={showSettingsAtBottom}
                              readOnly={true}
                              disabled={isOffline}
                              onClick={() => {
                                if (!isOffline) {
                                  userContext.updateUserSetting(Setting.showSettingsAtBottom, !showSettingsAtBottom ? 'true' : 'false');
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className={'divider'}></div>
                    <div className={isOffline ? 'tooltip' : ''} data-tip={isOffline ? 'Nicht verfügbar im Offline-Modus' : undefined}>
                      <ThemeChanger disabled={isOffline} />
                    </div>
                    {isOffline && <span className="text-xs text-warning">Nicht verfügbar im Offline-Modus</span>}
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
              {selectedCardId != 'search' && selectedCardId != 'order' && selectedCardId != undefined ? (
                <div className={'tooltip' + (showSettingsAtBottom ? ' mr-1' : '')} data-tip={'Suche (Shift + F)'}>
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
            {isOffline ? (
              <div className={'tooltip tooltip-left'} data-tip="Nicht verfügbar im Offline-Modus">
                <div className={'btn btn-square btn-disabled rounded-xl md:btn-lg'}>
                  <BsFillGearFill />
                </div>
              </div>
            ) : (
              <Link href={`/workspaces/${workspaceId}/manage`}>
                <div className={'btn btn-square btn-primary rounded-xl md:btn-lg'}>
                  <BsFillGearFill />
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default OverviewPage;
