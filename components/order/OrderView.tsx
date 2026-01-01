import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailCardFull } from '../../models/CocktailCardFull';
import { GlassModel } from '../../models/GlassModel';
import { fetchGlasses } from '../../lib/network/glasses';
import { addCocktailToQueue } from '../../lib/network/cocktailTracking';
import { alertService } from '../../lib/alertService';
import { Loading } from '../Loading';
import { BsSearch } from 'react-icons/bs';
import { FaMinus, FaPlus, FaReply, FaTrash } from 'react-icons/fa';
import AvatarImage from '../AvatarImage';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { ModalContext } from '@lib/context/ModalContextProvider';
import '../../lib/NumberUtils';

interface OrderItem {
  type: 'cocktail' | 'glass';
  id: string;
  name: string;
  price: number;
  deposit: number;
  amount: number;
  returnedDeposit: number; // Anzahl zurückgegebener Gläser (Pfand wird abgezogen)
  notes?: string; // Kommentar für Cocktails
}

interface OrderViewProps {
  cocktailCards: CocktailCardFull[];
  workspaceId: string;
}

export const OrderView = React.memo(function OrderView({ cocktailCards, workspaceId }: OrderViewProps) {
  const router = useRouter();
  const modalContext = useContext(ModalContext);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [filteredCocktails, setFilteredCocktails] = useState<CocktailRecipeFull[]>([]);
  const [glasses, setGlasses] = useState<GlassModel[]>([]);
  const [glassesLoading, setGlassesLoading] = useState(false);
  const [cocktailsLoading, setCocktailsLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalNotes, setGlobalNotes] = useState<string>('');

  // Fetch glasses
  useEffect(() => {
    fetchGlasses(workspaceId, setGlasses, setGlassesLoading);
  }, [workspaceId]);

  // Fetch cocktails
  useEffect(() => {
    if (!workspaceId) return;
    setCocktailsLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails?search=`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktails(body.data);
        } else {
          console.error('OrderView -> fetchCocktails', response);
          alertService.error(body.error ?? 'Fehler beim Laden der Cocktails', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('OrderView -> fetchCocktails', error);
        alertService.error('Fehler beim Laden der Cocktails');
      })
      .finally(() => setCocktailsLoading(false));
  }, [workspaceId]);

  // Filter cocktails based on search term (used for "Alle Cocktails"-Ansicht)
  useEffect(() => {
    const searchLower = searchTerm.toLowerCase().trim();

    const filtered = cocktails.filter((c) => {
      if (c.isArchived) return false;
      if (!searchLower) return true;

      return (
        c.name.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower) ||
        c.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    });

    setFilteredCocktails(filtered);
  }, [cocktails, searchTerm]);

  const addReturnedGlass = useCallback(
    (glass: GlassModel) => {
      // Ein Glas wurde zurückgegeben (Pfand wird abgezogen)
      const existingItem = orderItems.find((item) => item.type === 'glass' && item.id === glass.id);

      if (existingItem) {
        setOrderItems(orderItems.map((item) => (item === existingItem ? { ...item, returnedDeposit: item.returnedDeposit + 1 } : item)));
      } else {
        setOrderItems([
          ...orderItems,
          {
            type: 'glass',
            id: glass.id,
            name: glass.name,
            price: 0,
            deposit: glass.deposit,
            amount: 0,
            returnedDeposit: 1,
          },
        ]);
      }
    },
    [orderItems],
  );

  const addCocktailToOrder = useCallback(
    (cocktail: CocktailRecipeFull, isReturnedDeposit: boolean = false) => {
      if (isReturnedDeposit) {
        // Ein gleiches Glas wurde zurückgegeben - erstelle ein separates Glas-Item
        if (!cocktail.glass) {
          alertService.warn('Cocktail hat kein Glas');
          return;
        }

        // Finde das entsprechende Glas in der Gläser-Liste
        const glass = glasses.find((g) => g.id === cocktail.glass?.id);
        if (!glass) {
          alertService.warn('Glas nicht gefunden');
          return;
        }

        // Verwende die gleiche Logik wie beim direkten Auswählen eines Glases
        addReturnedGlass(glass);
      } else {
        // Neuer Cocktail - das Glas-Pfand ist bereits im Cocktail-Item enthalten
        const existingItem = orderItems.find((item) => item.type === 'cocktail' && item.id === cocktail.id);

        if (existingItem) {
          setOrderItems(orderItems.map((item) => (item === existingItem ? { ...item, amount: item.amount + 1 } : item)));
        } else {
          setOrderItems([
            ...orderItems,
            {
              type: 'cocktail',
              id: cocktail.id,
              name: cocktail.name,
              price: cocktail.price ?? 0,
              deposit: cocktail.glass?.deposit ?? 0,
              amount: 1,
              returnedDeposit: 0,
              notes: '',
            },
          ]);
        }
      }
    },
    [orderItems, glasses, addReturnedGlass],
  );

  const updateItemAmount = useCallback(
    (item: OrderItem, delta: number) => {
      if (item.amount + delta <= 0) {
        setOrderItems(orderItems.filter((i) => i !== item));
      } else {
        setOrderItems(orderItems.map((i) => (i === item ? { ...item, amount: item.amount + delta } : i)));
      }
    },
    [orderItems],
  );

  const addReturnedDeposit = useCallback(
    (item: OrderItem) => {
      // Ein gleiches Glas wurde zurückgegeben (Pfand wird abgezogen)
      setOrderItems(orderItems.map((i) => (i === item ? { ...item, returnedDeposit: item.returnedDeposit + 1 } : i)));
    },
    [orderItems],
  );

  const removeReturnedDeposit = useCallback(
    (item: OrderItem, delta: number = 1) => {
      if (item.returnedDeposit - delta <= 0) {
        // Wenn keine zurückgegebenen Gläser mehr, Item entfernen wenn auch amount 0
        if (item.amount === 0) {
          setOrderItems(orderItems.filter((i) => i !== item));
        } else {
          setOrderItems(orderItems.map((i) => (i === item ? { ...item, returnedDeposit: 0 } : i)));
        }
      } else {
        setOrderItems(orderItems.map((i) => (i === item ? { ...item, returnedDeposit: item.returnedDeposit - delta } : i)));
      }
    },
    [orderItems],
  );

  const clearOrder = useCallback(() => {
    setOrderItems([]);
  }, []);

  const addToQueue = useCallback(async () => {
    const cocktailItems = orderItems.filter((item) => item.type === 'cocktail');

    if (cocktailItems.length === 0) {
      alertService.warn('Keine Cocktails in der Bestellung');
      return;
    }

    setSubmitting(true);
    try {
      // Sortiere Cocktails nach Name, damit sie korrekt gruppiert werden
      const sortedCocktailItems = [...cocktailItems].sort((a, b) => a.name.localeCompare(b.name));
      // Füge Cocktails sequenziell hinzu, damit die Reihenfolge erhalten bleibt
      for (const item of sortedCocktailItems) {
        await addCocktailToQueue({
          workspaceId,
          cocktailId: item.id,
          amount: item.amount,
          notes: globalNotes.trim() || undefined,
          setSubmitting: () => {},
          onSuccess: () => {},
        });
      }

      alertService.success('Alle Cocktails zur Warteschlange hinzugefügt');
      clearOrder();
      setGlobalNotes('');
    } catch (error) {
      console.error('OrderView -> addToQueue', error);
      alertService.error('Fehler beim Hinzufügen zur Warteschlange');
    } finally {
      setSubmitting(false);
    }
  }, [orderItems, workspaceId, clearOrder, globalNotes]);

  // Calculate totals
  const totalCocktailPrice = orderItems.filter((item) => item.type === 'cocktail').reduce((sum, item) => sum + item.price * item.amount, 0);

  // Pfand für neue Gläser (bei Cocktails mit deposit)
  const totalNewDeposit = orderItems.filter((item) => item.type === 'cocktail' && item.deposit > 0).reduce((sum, item) => sum + item.deposit * item.amount, 0);

  // Zurückgegebener Pfand (wird abgezogen)
  const totalReturnedDeposit = orderItems.reduce((sum, item) => sum + item.deposit * item.returnedDeposit, 0);

  const totalPrice = totalCocktailPrice + totalNewDeposit - totalReturnedDeposit;
  const depositReturn = totalReturnedDeposit;

  // Group glasses by deposit
  const groupedGlasses = glasses.reduce(
    (acc, glass) => {
      const depositKey = glass.deposit.toString();
      if (!acc[depositKey]) {
        acc[depositKey] = [];
      }
      acc[depositKey].push(glass);
      return acc;
    },
    {} as Record<string, GlassModel[]>,
  );

  const selectedCard = selectedCardId && selectedCardId !== 'all' ? cocktailCards.find((card) => card.id === selectedCardId) : undefined;

  // Cocktails, die explizit in der ausgewählten Karte vorkommen
  const cocktailsOnSelectedCardIds = selectedCard
    ? new Set<string>(
        selectedCard.groups
          .flatMap((group: any) => group.items ?? [])
          .map((item: any) => item.cocktailId)
          .filter((id: string | undefined) => !!id),
      )
    : new Set<string>();

  // Weitere Cocktails, die durch die Suche gefunden werden, aber nicht auf der aktuellen Karte liegen
  const additionalCocktailsForSearch =
    selectedCard && selectedCardId !== 'all' && searchTerm.trim().length > 0
      ? filteredCocktails.filter((cocktail) => !cocktailsOnSelectedCardIds.has(cocktail.id))
      : [];

  const matchesSearchTerm = (cocktail: CocktailRecipeFull) => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return !cocktail.isArchived;
    if (cocktail.isArchived) return false;

    return (
      cocktail.name.toLowerCase().includes(searchLower) ||
      cocktail.description?.toLowerCase().includes(searchLower) ||
      cocktail.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  };

  const getCocktailsForGroup = (group: any): CocktailRecipeFull[] => {
    return group.items
      .sort((a: any, b: any) => (a.itemNumber ?? 0) - (b.itemNumber ?? 0))
      .map((item: any) => cocktails.find((c) => c.id === item.cocktailId))
      .filter((cocktail: CocktailRecipeFull | undefined): cocktail is CocktailRecipeFull => !!cocktail && matchesSearchTerm(cocktail));
  };

  const CocktailTile = React.memo(function CocktailTile({ cocktail }: { cocktail: CocktailRecipeFull }) {
    const price = cocktail.price ?? 0;
    const deposit = cocktail.glass?.deposit ?? 0;

    return (
      <button
        key={cocktail.id}
        type="button"
        className="flex w-40 flex-col items-center gap-2 rounded-lg border border-base-300 bg-base-200/60 p-2 text-center text-sm transition hover:border-primary hover:bg-base-200"
        onClick={() => addCocktailToOrder(cocktail, false)}
      >
        <div className="h-20 w-20 overflow-hidden rounded-full bg-base-300">
          {cocktail._count?.CocktailRecipeImage && cocktail._count.CocktailRecipeImage > 0 ? (
            <AvatarImage
              src={`/api/workspaces/${workspaceId}/cocktails/${cocktail.id}/image`}
              alt={cocktail.name}
              altComponent={
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold">{cocktail.name.trim().charAt(0).toUpperCase()}</div>
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold">{cocktail.name.trim().charAt(0).toUpperCase()}</div>
          )}
        </div>
        <div className="line-clamp-2 text-xs font-medium">{cocktail.name}</div>
        <div className="text-xs text-base-content/80">
          {price.formatPrice()} € {deposit > 0 && <span className="text-[0.65rem] text-base-content/60">(+ {deposit.formatPrice()} € Pfand)</span>}
        </div>
      </button>
    );
  });

  return (
    <div className="flex h-screen flex-col gap-2">
      {/* Erste Zeile: Kombinierte Suche & Cocktails nach Karte (volle Breite, nur horizontal scrollend) */}
      <div className="flex max-h-[50vh] flex-1 flex-col overflow-hidden">
        <div className="card h-full bg-base-100 shadow-md">
          <div className="card-body flex h-full flex-col">
            {/* Header: Titel, Suche, Kartenauswahl */}
            <div className="flex flex-col items-start gap-2 md:flex-row md:justify-between">
              <div className={'h-full items-center'}>
                <h2 className="card-title text-xl">Übersicht</h2>
                <p className="text-sm text-base-content/70">Füge Cocktails einfach zur Bestellung hinzu.</p>
              </div>
              <div className="flex w-full flex-row items-end gap-2 md:w-2/3">
                <div className="flex-1">
                  <label className="label flex items-baseline justify-between py-1">
                    <span className="label-text text-xs xl:text-base">Cocktail suchen</span>
                    <span className="text-xs text-base-content/60">
                      {cocktailsLoading
                        ? 'Lade Cocktails...'
                        : filteredCocktails.length > 0
                          ? `${filteredCocktails.length} Cocktail${filteredCocktails.length === 1 ? '' : 's'} gefunden`
                          : 'Keine Cocktails gefunden'}
                    </span>
                  </label>
                  <div className="join w-full">
                    <input
                      className="input input-sm join-item input-bordered w-full xl:input-md"
                      placeholder="Name, Beschreibung oder Tags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                      type="button"
                      className={`btn ${cocktailsLoading ? 'w-fit px-2' : 'btn-square'} btn-outline btn-primary join-item btn-sm xl:btn-md`}
                      disabled={cocktailsLoading}
                    >
                      {cocktailsLoading ? <span className="loading loading-spinner loading-xs"></span> : <BsSearch />}
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="label py-1">
                    <span className="label-text text-xs xl:text-base">Karte auswählen</span>
                  </label>
                  <select
                    className="select select-bordered select-sm w-full xl:select-md"
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    <option value="all">Alle Cocktails</option>
                    {cocktailCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Inhalt: Gruppen & Cocktails horizontal */}
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
              {cocktailsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loading />
                </div>
              ) : selectedCardId === 'all' || !selectedCard ? (
                <>
                  {filteredCocktails.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-gray-500">Keine Cocktails gefunden</div>
                  ) : (
                    <div className="flex h-full items-stretch gap-2">
                      {/* Pseudo-Gruppe "Alle" */}
                      <div className="2 flex h-full w-full flex-col">
                        <h3 className="shrink-0 text-lg font-semibold">Alle Cocktails</h3>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          <div className="flex flex-row flex-wrap justify-between gap-2">
                            {filteredCocktails
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((cocktail) => (
                                <CocktailTile key={cocktail.id} cocktail={cocktail} />
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-stretch gap-2">
                  {selectedCard.groups
                    .sort((a: any, b: any) => (a.groupNumber ?? 0) - (b.groupNumber ?? 0))
                    .map((group: any) => {
                      const cocktailsInGroup = getCocktailsForGroup(group);
                      if (cocktailsInGroup.length === 0) {
                        return null;
                      }

                      return (
                        <div key={group.id ?? group.name} className={`flex h-full ${cocktailsInGroup.length > 1 ? 'min-w-[21rem]' : ''} flex-col gap-2`}>
                          <h3 className="shrink-0 text-lg font-semibold">{group.name}</h3>
                          <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="flex flex-row flex-wrap gap-2">
                              {cocktailsInGroup.map((cocktail) => (
                                <CocktailTile key={cocktail.id} cocktail={cocktail} />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {additionalCocktailsForSearch.length > 0 && (
                    <div className="flex h-full w-full flex-col gap-2">
                      <h3 className="shrink-0 text-lg font-semibold">Weitere Cocktails</h3>
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="flex flex-row flex-wrap gap-2">
                          {additionalCocktailsForSearch
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((cocktail) => (
                              <CocktailTile key={cocktail.id} cocktail={cocktail} />
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zweite Zeile: Gläser (1/2) & Bestellung (1/2) */}
      <div className="flex max-h-[50vh] flex-1 flex-col gap-2 overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Gläser */}
        <div className="w-full md:w-1/2">
          <div className="card h-full bg-base-100 shadow-md">
            <div className="card-body flex h-full flex-col">
              <h2 className="card-title text-xl">Gläser</h2>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                {glassesLoading ? (
                  <Loading />
                ) : glasses.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">Keine Gläser vorhanden</div>
                ) : (
                  Object.entries(groupedGlasses)
                    .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                    .map(([deposit, glassesInGroup]) => (
                      <div key={deposit} className="card bg-base-100 shadow-md">
                        <div className="card-body p-4">
                          <div className="mb-2">
                            <h3 className="card-title text-lg">Pfand: {parseFloat(deposit).formatPrice()} €</h3>
                          </div>
                          <div className="flex flex-wrap justify-between gap-2">
                            {glassesInGroup.map((glass) => (
                              <div
                                key={glass.id}
                                className="flex flex-col items-center gap-2 rounded-lg border border-base-300 bg-base-200/60 p-2 text-center text-xs transition hover:cursor-pointer hover:border-primary hover:bg-base-200"
                                onClick={() => addReturnedGlass(glass)}
                              >
                                <div className="h-16 w-16 overflow-hidden rounded-full bg-base-300">
                                  {glass._count?.GlassImage == 0 ? (
                                    <DefaultGlassIcon />
                                  ) : (
                                    <AvatarImage
                                      src={`/api/workspaces/${workspaceId}/glasses/${glass.id}/image`}
                                      alt={glass.name}
                                      altComponent={<DefaultGlassIcon />}
                                    />
                                  )}
                                </div>
                                <span className="max-w-[4rem] break-words text-center text-xs">{glass.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bestellung */}
        <div className="w-full md:w-1/2">
          <div className="card h-full bg-base-100 shadow-lg">
            <div className="card-body flex h-full flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="card-title text-2xl">Bestellung</h2>
                <button
                  className="btn btn-outline btn-error btn-xs xl:btn-sm"
                  onClick={() => {
                    clearOrder();
                    setGlobalNotes('');
                  }}
                  disabled={orderItems.length === 0}
                >
                  <FaTrash />
                  Bestellung leeren
                </button>
              </div>
              {orderItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-8 text-center text-gray-500">Keine Cocktails oder Gläser in der Bestellung</div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                    <table className="table table-zebra table-xs xl:table-md">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Anzahl</th>
                          <th>Preis</th>
                          <th>Pfand</th>
                          <th className={'text-right'}>Gesamt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems
                          .filter((item) => item.amount > 0 || item.returnedDeposit > 0)
                          .map((item, index) => {
                            const newDeposit = item.type === 'cocktail' && item.deposit > 0 ? item.deposit * item.amount : 0;
                            const returnedDeposit = item.deposit * item.returnedDeposit;
                            const itemTotal = item.type === 'cocktail' ? item.price * item.amount + newDeposit - returnedDeposit : -returnedDeposit;

                            return (
                              <tr key={`${item.type}-${item.id}-${index}`}>
                                <td>{item.name}</td>
                                <td>
                                  {(item.amount > 0 || item.returnedDeposit > 0) && (
                                    <div className="flex">
                                      {item.amount > 0 && (
                                        <div className="flex flex-row justify-center gap-1">
                                          <div className={'join'}>
                                            <button
                                              className="btn btn-outline btn-secondary join-item btn-xs xl:btn-sm"
                                              onClick={() => updateItemAmount(item, -1)}
                                            >
                                              <FaMinus />
                                            </button>
                                            <span className="btn btn-outline btn-primary join-item btn-xs pointer-events-none xl:btn-sm">{item.amount}</span>
                                            <button
                                              className="btn btn-outline btn-secondary join-item btn-xs border-l-primary xl:btn-sm"
                                              onClick={() => updateItemAmount(item, 1)}
                                            >
                                              <FaPlus />
                                            </button>
                                          </div>
                                          {item.type === 'cocktail' && item.deposit > 0 && (
                                            <button
                                              className="btn btn-outline btn-xs w-fit xl:btn-sm"
                                              onClick={() => {
                                                // Finde das entsprechende Glas und erstelle ein separates Glas-Item
                                                const cocktail = cocktails.find((c) => c.id === item.id);
                                                if (cocktail?.glass) {
                                                  const glass = glasses.find((g) => g.id === cocktail.glass?.id);
                                                  if (glass) {
                                                    addReturnedGlass(glass);
                                                  }
                                                }
                                              }}
                                            >
                                              <FaReply /> Glas
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {item.amount === 0 && item.returnedDeposit > 0 && (
                                        <div className="join">
                                          <button
                                            className="btn btn-outline btn-secondary join-item btn-xs xl:btn-sm"
                                            onClick={() => removeReturnedDeposit(item, 1)}
                                          >
                                            <FaMinus />
                                          </button>
                                          <span className="btn btn-outline btn-primary join-item btn-xs pointer-events-none xl:btn-sm">
                                            {item.returnedDeposit}
                                          </span>
                                          <button
                                            className="btn btn-outline btn-secondary join-item btn-xs border-l-primary xl:btn-sm"
                                            onClick={() => addReturnedDeposit(item)}
                                          >
                                            <FaPlus />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className={'text-nowrap'}>
                                  {item.type === 'cocktail' && item.amount > 0 ? (item.price * item.amount).formatPrice() : '0.00'} €
                                </td>
                                <td>
                                  <div className="flex flex-col gap-1">
                                    {newDeposit > 0 && <span className="text-nowrap">+{newDeposit.formatPrice()} €</span>}
                                    {returnedDeposit > 0 && <span className="text-nowrap text-success">-{returnedDeposit.formatPrice()} €</span>}
                                    {newDeposit === 0 && returnedDeposit === 0 && <span className="text-nowrap">0.00 €</span>}
                                  </div>
                                </td>
                                <td className="text-nowrap text-right font-bold">{itemTotal.formatPrice()} €</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <div className={'grid grid-cols-1 xl:grid-cols-2'}>
                    <div className="hidden xl:block"></div>
                    <div className="flex flex-col gap-1 text-xs xl:text-base">
                      <div className="flex justify-between">
                        <span className={'font-semibold'}>Gesamtpreis Cocktails (ohne Pfand)</span>
                        <span>{totalCocktailPrice.formatPrice()} €</span>
                      </div>
                      {totalNewDeposit > 0 && (
                        <div className="flex justify-between">
                          <span className={'font-semibold'}>Pfand (neu)</span>
                          <span>+{totalNewDeposit.formatPrice()} €</span>
                        </div>
                      )}
                      {totalReturnedDeposit > 0 && (
                        <div className="flex justify-between">
                          <span className={'font-semibold'}>Pfand zurück</span>
                          <span className="text-success">-{totalReturnedDeposit.formatPrice()} €</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>Gesamtpreis</span>
                        <span className="text-right text-primary">{totalPrice.formatPrice()} €</span>
                      </div>
                    </div>
                  </div>
                  <div className="gap-2">
                    <div className="card-actions flex gap-2">
                      <div className="form-control flex-1">
                        <label className="label text-xs xl:text-base">
                          <span className="label-text">Notiz für alle Cocktails</span>
                        </label>
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full xl:input-md"
                          placeholder="z.B. Für Tim und Freunde ..."
                          value={globalNotes}
                          onChange={(e) => setGlobalNotes(e.target.value)}
                        />
                      </div>
                      <button
                        className="btn btn-primary btn-sm self-end xl:btn-md"
                        onClick={addToQueue}
                        disabled={submitting || orderItems.filter((item) => item.type === 'cocktail').length === 0}
                      >
                        {submitting ? <span className="loading loading-spinner"></span> : 'Zur Warteschlange hinzufügen'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
