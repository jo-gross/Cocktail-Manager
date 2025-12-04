import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailCardFull } from '../../models/CocktailCardFull';
import { GlassModel } from '../../models/GlassModel';
import { CompactCocktailCard } from './CompactCocktailCard';
import { fetchGlasses } from '../../lib/network/glasses';
import { addCocktailToQueue } from '../../lib/network/cocktailTracking';
import { alertService } from '../../lib/alertService';
import { Loading } from '../Loading';
import { BsSearch } from 'react-icons/bs';
import { FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import AvatarImage from '../AvatarImage';
import DefaultGlassIcon from '../DefaultGlassIcon';
import { ModalContext } from '@lib/context/ModalContextProvider';
import ImageModal from '../modals/ImageModal';
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

export function OrderView({ cocktailCards, workspaceId }: OrderViewProps) {
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

  // Filter cocktails based on selected card and search term
  useEffect(() => {
    let filtered = cocktails.filter((c) => !c.isArchived);

    // Filter by selected card
    if (selectedCardId && selectedCardId !== 'all') {
      const selectedCard = cocktailCards.find((card) => card.id === selectedCardId);
      if (selectedCard) {
        const cardCocktailIds = new Set(
          selectedCard.groups.flatMap((group) => group.items.map((item) => item.cocktailId)),
        );
        filtered = filtered.filter((c) => cardCocktailIds.has(c.id));
      }
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description?.toLowerCase().includes(searchLower) ||
          c.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    setFilteredCocktails(filtered);
  }, [cocktails, selectedCardId, searchTerm, cocktailCards]);

  const addReturnedGlass = useCallback(
    (glass: GlassModel) => {
      // Ein Glas wurde zurückgegeben (Pfand wird abgezogen)
      const existingItem = orderItems.find((item) => item.type === 'glass' && item.id === glass.id);

      if (existingItem) {
        setOrderItems(
          orderItems.map((item) =>
            item === existingItem
              ? { ...item, returnedDeposit: item.returnedDeposit + 1 }
              : item,
          ),
        );
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
        const existingItem = orderItems.find(
          (item) => item.type === 'cocktail' && item.id === cocktail.id,
        );

        if (existingItem) {
          setOrderItems(
            orderItems.map((item) =>
              item === existingItem ? { ...item, amount: item.amount + 1 } : item,
            ),
          );
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
        setOrderItems(
          orderItems.map((i) => (i === item ? { ...item, amount: item.amount + delta } : i)),
        );
      }
    },
    [orderItems],
  );

  const addReturnedDeposit = useCallback(
    (item: OrderItem) => {
      // Ein gleiches Glas wurde zurückgegeben (Pfand wird abgezogen)
      setOrderItems(
        orderItems.map((i) =>
          i === item ? { ...item, returnedDeposit: item.returnedDeposit + 1 } : i,
        ),
      );
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
          setOrderItems(
            orderItems.map((i) => (i === item ? { ...item, returnedDeposit: 0 } : i)),
          );
        }
      } else {
        setOrderItems(
          orderItems.map((i) =>
            i === item ? { ...item, returnedDeposit: item.returnedDeposit - delta } : i,
          ),
        );
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
  const totalCocktailPrice = orderItems
    .filter((item) => item.type === 'cocktail')
    .reduce((sum, item) => sum + item.price * item.amount, 0);

  // Pfand für neue Gläser (bei Cocktails mit deposit)
  const totalNewDeposit = orderItems
    .filter((item) => item.type === 'cocktail' && item.deposit > 0)
    .reduce((sum, item) => sum + item.deposit * item.amount, 0);

  // Zurückgegebener Pfand (wird abgezogen)
  const totalReturnedDeposit = orderItems.reduce(
    (sum, item) => sum + item.deposit * item.returnedDeposit,
    0,
  );

  const totalPrice = totalCocktailPrice + totalNewDeposit - totalReturnedDeposit;
  const depositReturn = totalReturnedDeposit;

  // Group glasses by deposit
  const groupedGlasses = glasses.reduce((acc, glass) => {
    const depositKey = glass.deposit.toString();
    if (!acc[depositKey]) {
      acc[depositKey] = [];
    }
    acc[depositKey].push(glass);
    return acc;
  }, {} as Record<string, GlassModel[]>);

  return (
    <div className="flex flex-col gap-2 md:flex-row">
      {/* Left side - Selection */}
      <div className="w-full flex-1 space-y-2">
        {/* Cocktail Selection Accordion */}
        <div className="collapse collapse-arrow rounded-box border border-base-300 bg-base-200">
          <input type="checkbox" defaultChecked={true} />
          <div className="collapse-title text-xl font-medium">Cocktails</div>
          <div className="collapse-content">
            <div className="space-y-2">
              {/* Card Selection Dropdown */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Karte auswählen</span>
                </label>
                <select
                  className="select select-bordered w-full"
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

              {/* Search Field */}
              <div className="join w-full">
                <input
                  className="input join-item input-bordered w-full"
                  placeholder="Cocktail suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="button"
                  className={`btn ${cocktailsLoading ? 'w-fit px-2' : 'btn-square'} btn-outline btn-primary join-item`}
                  disabled={cocktailsLoading}
                >
                  {cocktailsLoading ? <span className="loading loading-spinner loading-xs"></span> : <BsSearch />}
                </button>
              </div>

              {/* Cocktail Cards */}
              <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-2">
                {cocktailsLoading ? (
                  <Loading />
                ) : filteredCocktails.length === 0 ? (
                  <div className="text-center text-gray-500">Keine Cocktails gefunden</div>
                ) : (
                  filteredCocktails.map((cocktail) => (
                    <CompactCocktailCard
                      key={cocktail.id}
                      cocktail={cocktail}
                      onAdd={() => addCocktailToOrder(cocktail, false)}
                      onAddWithDeposit={() => addCocktailToOrder(cocktail, true)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Glasses Accordion */}
        <div className="collapse collapse-arrow rounded-box border border-base-300 bg-base-200">
          <input type="checkbox" defaultChecked={true} />
          <div className="collapse-title text-xl font-medium">Gläser</div>
          <div className="collapse-content">
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-4">
              {glassesLoading ? (
                <Loading />
              ) : glasses.length === 0 ? (
                <div className="text-center text-gray-500">Keine Gläser vorhanden</div>
              ) : (
                Object.entries(groupedGlasses)
                  .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                  .map(([deposit, glassesInGroup]) => (
                    <div key={deposit} className="card bg-base-100 shadow-md">
                      <div className="card-body p-4">
                        <div className="mb-2">
                          <h3 className="card-title text-lg">
                            Pfand: {parseFloat(deposit).formatPrice()} €
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {glassesInGroup.map((glass) => (
                            <div
                              key={glass.id}
                              className="flex flex-col items-center gap-1 cursor-pointer rounded-lg border border-base-300 p-2 hover:border-primary transition-colors"
                              onClick={() => addReturnedGlass(glass)}
                            >
                              <div className="h-16 w-16">
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
                              <span className="text-xs text-center max-w-[4rem] break-words">{glass.name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2">
                          <button
                            className="btn btn-outline btn-primary btn-sm w-full"
                            onClick={() => {
                              // Add first glass as returned
                              if (glassesInGroup.length > 0) {
                                addReturnedGlass(glassesInGroup[0]);
                              }
                            }}
                          >
                            - Pfand ({parseFloat(deposit).formatPrice()} €)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Order List */}
      <div className="w-full flex-1">
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Bestellung</h2>
            {orderItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Keine Cocktails oder Gläser in der Bestellung</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Anzahl</th>
                        <th>Preis (ohne Pfand)</th>
                        <th>Pfand</th>
                        <th>Gesamt</th>
                        <th>Aktionen</th>
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
                                  <div className="join">
                                    {item.amount > 0 && (
                                      <>
                                        <button
                                          className="btn btn-sm join-item"
                                          onClick={() => updateItemAmount(item, -1)}
                                        >
                                          <FaMinus />
                                        </button>
                                        <span className="btn btn-sm join-item pointer-events-none">
                                          {item.amount}
                                        </span>
                                        <button
                                          className="btn btn-sm join-item"
                                          onClick={() => updateItemAmount(item, 1)}
                                        >
                                          <FaPlus />
                                        </button>
                                      </>
                                    )}
                                    {item.amount === 0 && item.returnedDeposit > 0 && (
                                      <>
                                        <button
                                          className="btn btn-sm join-item"
                                          onClick={() => removeReturnedDeposit(item, 1)}
                                        >
                                          <FaMinus />
                                        </button>
                                        <span className="btn btn-sm join-item pointer-events-none">
                                          {item.returnedDeposit}
                                        </span>
                                        <button
                                          className="btn btn-sm join-item"
                                          onClick={() => addReturnedDeposit(item)}
                                        >
                                          <FaPlus />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td>
                                {item.type === 'cocktail' && item.amount > 0
                                  ? (item.price * item.amount).formatPrice()
                                  : '0.00'}{' '}
                                €
                              </td>
                              <td>
                                <div className="flex flex-col gap-1">
                                  {newDeposit > 0 && (
                                    <span className="text-sm">+{newDeposit.formatPrice()} €</span>
                                  )}
                                  {returnedDeposit > 0 && (
                                    <span className="text-sm text-success">-{returnedDeposit.formatPrice()} €</span>
                                  )}
                                  {newDeposit === 0 && returnedDeposit === 0 && (
                                    <span className="text-sm">0.00 €</span>
                                  )}
                                </div>
                              </td>
                              <td className="font-bold">
                                {itemTotal.formatPrice()} €
                              </td>
                              <td>
                                {item.type === 'cocktail' && item.deposit > 0 && (
                                  <button
                                    className="btn btn-xs btn-outline"
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
                                    Glas zurück
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan={4}>Gesamtpreis Cocktails (ohne Pfand)</th>
                        <th className="font-bold">{totalCocktailPrice.formatPrice()} €</th>
                        <th></th>
                      </tr>
                      {totalNewDeposit > 0 && (
                        <tr>
                          <th colSpan={4}>Pfand (neu)</th>
                          <th className="font-bold">+{totalNewDeposit.formatPrice()} €</th>
                          <th></th>
                        </tr>
                      )}
                      {totalReturnedDeposit > 0 && (
                        <tr>
                          <th colSpan={4}>Pfand zurück</th>
                          <th className="font-bold text-success">-{totalReturnedDeposit.formatPrice()} €</th>
                          <th></th>
                        </tr>
                      )}
                      <tr className="text-lg">
                        <th colSpan={4}>Gesamtpreis</th>
                        <th className="font-bold text-primary">{totalPrice.formatPrice()} €</th>
                        <th></th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Notiz für alle Cocktails der Bestellung</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="z.B. Für Tim und Freunde ..."
                      value={globalNotes}
                      onChange={(e) => setGlobalNotes(e.target.value)}
                    />
                  </div>
                  <div className="card-actions flex gap-2">
                    <button
                      className="btn btn-error flex-1 btn-outline"
                      onClick={() => {
                        clearOrder();
                        setGlobalNotes('');
                      }}
                      disabled={orderItems.length === 0}
                    >
                      <FaTrash />
                      Bestellung leeren
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={addToQueue}
                      disabled={submitting || orderItems.filter((item) => item.type === 'cocktail').length === 0}
                    >
                      {submitting ? (
                        <span className="loading loading-spinner"></span>
                      ) : (
                        'Zur Warteschlange hinzufügen'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

