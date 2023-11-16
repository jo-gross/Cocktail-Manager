import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { FaPencilAlt, FaPrint, FaTrashAlt } from 'react-icons/fa';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';
import { SearchModal } from '../../../../../components/modals/SearchModal';
import { alertService } from '../../../../../lib/alertService';
import { calcCocktailTotalPrice } from '../../../../../lib/CocktailRecipeCalculation';
import { Garnish, Ingredient } from '@prisma/client';
import InputModal from '../../../../../components/modals/InputModal';
import { PageCenter } from '../../../../../components/layout/PageCenter';
import { Loading } from '../../../../../components/Loading';
import { DeleteConfirmationModal } from '../../../../../components/modals/DeleteConfirmationModal';

interface CocktailCalculationItem {
  cocktail: CocktailRecipeFull;
  plannedAmount: number;
  customPrice: number | undefined;
}

interface IngredientCalculationItem {
  ingredient: Ingredient;
  amount: number;
}

interface GarnishCalculationItem {
  garnish: Garnish;
  amount: number;
}

interface CalculationData {
  name: string;
  showSalesStuff: boolean;
  cocktailCalculationItems: CocktailCalculationItem[];
}

export default function CalculationPage() {
  const modalContext = useContext(ModalContext);

  const router = useRouter();
  const { id } = router.query;

  const { workspaceId } = router.query;

  const [calculationName, setCalculationName] = useState<string>('');
  const [cocktailCalculationItems, setCocktailCalculationItems] = useState<CocktailCalculationItem[]>([]);

  const [originalItems, setOriginalItems] = useState<string>('[]');

  const [ingredientCalculationItems, setIngredientCalculationItems] = useState<IngredientCalculationItem[]>([]);
  const [garnishCalculationItems, setGarnishCalculationItems] = useState<GarnishCalculationItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [showSalesStuff, setShowSalesStuff] = useState<boolean>(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  useEffect(() => {
    if (originalItems != JSON.stringify(cocktailCalculationItems)) {
      setUnsavedChanges(true);
    } else {
      setUnsavedChanges(false);
    }
  }, [cocktailCalculationItems, originalItems]);

  useEffect(() => {
    if (!id) return;
    if (id == 'create') return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/calculations/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          const data: CalculationData = body.data;
          setCalculationName(data.name);
          setCocktailCalculationItems(data.cocktailCalculationItems);
          setOriginalItems(JSON.stringify(data.cocktailCalculationItems));
          setShowSalesStuff(data.showSalesStuff ?? true);
        } else {
          console.error('CocktailCalculation -> useEffect[init, id != create]', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Kalkulation', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CocktailCalculation -> useEffect[init, id != create]', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, workspaceId]);

  const addCocktailToSelection = useCallback(
    (cocktailId: string) => {
      if (cocktailCalculationItems.find((item) => item.cocktail.id == cocktailId)) {
        const cocktailCalculationItem = cocktailCalculationItems.find((item) => item.cocktail.id == cocktailId)!;
        const reduced = cocktailCalculationItems.filter((item) => item.cocktail.id != cocktailId);
        setCocktailCalculationItems([
          ...reduced,
          {
            cocktail: cocktailCalculationItem.cocktail,
            plannedAmount: cocktailCalculationItem.plannedAmount + 1,
            customPrice: cocktailCalculationItem.customPrice,
          },
        ]);
      } else {
        fetch(`/api/workspaces/${workspaceId}/cocktails/${cocktailId}`)
          .then(async (response) => {
            const body = await response.json();
            if (response.ok) {
              setCocktailCalculationItems([...cocktailCalculationItems, { cocktail: body.data, plannedAmount: 1, customPrice: undefined }]);
            } else {
              console.error('CalculationId -> addCocktailToSelection (not already exists) -> fetchCocktail', response);
              alertService.error(body.message ?? 'Fehler beim Laden des Cocktails', response.status, response.statusText);
            }
          })
          .catch((error) => {
            console.error('CalculationId -> addCocktailToSelection (not already exists) -> fetchCocktail', error);
            alertService.error('Fehler beim Laden des Cocktails');
          })
          .finally(() => {});
      }
    },
    [cocktailCalculationItems, workspaceId],
  );

  //Ingredient Calculation
  useEffect(() => {
    let calculationItems: IngredientCalculationItem[] = [];

    cocktailCalculationItems.forEach((item) => {
      item.cocktail.steps.forEach((step) => {
        step.ingredients.forEach((ingredient) => {
          if (ingredient.ingredient != null) {
            let existingItem = calculationItems.find((calculationItem) => calculationItem.ingredient.id == ingredient.ingredientId);
            if (existingItem) {
              existingItem.amount += (ingredient.amount ?? 0) * item.plannedAmount;
              calculationItems = [...calculationItems.filter((item) => item.ingredient.id != existingItem?.ingredient.id), existingItem];
            } else {
              calculationItems.push({
                ingredient: ingredient.ingredient,
                amount: (ingredient.amount ?? 0) * item.plannedAmount,
              });
            }
          }
        });
      });
    });
    setIngredientCalculationItems(calculationItems);
  }, [cocktailCalculationItems]);

  //Garnish Calculation
  useEffect(() => {
    let calculationItems: GarnishCalculationItem[] = [];

    cocktailCalculationItems.forEach((item) => {
      item.cocktail.garnishes.forEach((garnish) => {
        let existingItem = calculationItems.find((calculationItem) => calculationItem.garnish.id == garnish.garnishId);
        if (existingItem) {
          existingItem.amount += item.plannedAmount;
          calculationItems = [...calculationItems.filter((item) => item.garnish.id != existingItem?.garnish.id), existingItem];
        } else {
          calculationItems.push({
            garnish: garnish.garnish,
            amount: item.plannedAmount,
          });
        }
      });
    });
    setGarnishCalculationItems(calculationItems);
  }, [cocktailCalculationItems]);

  const saveCalculationBackend = useCallback(
    (redirect: boolean = true) => {
      if (!id) return;
      if (!calculationName) return;
      setSaving(true);
      if (id == 'create') {
        const body = {
          name: calculationName,
          showSalesStuff: showSalesStuff,
          calculationItems: cocktailCalculationItems.map((item) => {
            return {
              plannedAmount: item.plannedAmount,
              customPrice: item.customPrice,
              cocktailId: item.cocktail.id,
            };
          }),
        };
        fetch(`/api/workspaces/${workspaceId}/calculations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(async (response) => {
            const body = await response.json();
            if (response.ok) {
              setOriginalItems(JSON.stringify(cocktailCalculationItems));
              if (redirect) {
                await router.push(`/workspaces/${workspaceId}/manage/calculations/${body.data.id}`);
              }
              alertService.success('Kalkulation erfolgreich erstellt');
            } else {
              console.error('CalculationId -> saveCalculation[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Kalkulation', response.status, response.statusText);
            }
          })
          .catch((error) => {
            console.error('CalculationId -> saveCalculation[create]', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          })
          .finally(() => {
            setSaving(false);
          });
      } else {
        // Update
        const body = {
          name: calculationName,
          showSalesStuff: showSalesStuff,
          calculationItems: cocktailCalculationItems.map((item) => {
            return {
              plannedAmount: item.plannedAmount,
              customPrice: item.customPrice,
              cocktailId: item.cocktail.id,
            };
          }),
        };
        fetch(`/api/workspaces/${workspaceId}/calculations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(async (response) => {
            const body = await response.json();
            if (response.ok) {
              setOriginalItems(JSON.stringify(cocktailCalculationItems));
              if (redirect) {
                await router.push(`/workspaces/${workspaceId}/manage/calculations/${body.data.id}`);
              }
              alertService.success('Kalkulation erfolgreich gespeichert');
            } else {
              console.error('CalculationId -> saveCalculation[update]', response);
              alertService.error(body.message ?? 'Fehler beim Aktualisieren der Kalkulation', response.status, response.statusText);
            }
          })
          .catch((error) => {
            console.error('CalculationId -> saveCalculation[update]', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          })
          .finally(() => {
            setSaving(false);
          });
      }
    },
    [id, calculationName, cocktailCalculationItems, workspaceId, router],
  );

  useEffect(() => {
    if (!id) return;
    if (!calculationName) return;

    if (id == 'create') {
      saveCalculationBackend();
    }
  }, [calculationName, id, saveCalculationBackend]);

  const openNameModal = useCallback(() => {
    modalContext.openModal(<InputModal title={'Kalkulation speichern'} onInputChange={(value) => setCalculationName(value)} defaultValue={calculationName} />);
  }, [calculationName, modalContext]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/calculations`}
      unsavedChanges={unsavedChanges}
      onSave={async () => {
        if (id == 'create' && calculationName.trim() == '') {
          openNameModal();
        } else {
          saveCalculationBackend(false);
          await router.replace(`/workspaces/${workspaceId}/manage/calculations`);
        }
      }}
      title={
        calculationName.trim() == '' ? (
          'Kalkulation'
        ) : (
          <div className={'flex flex-col items-center justify-center md:flex-row md:gap-2'}>
            <div className={'flex'}>
              <div>{calculationName}</div>
              <div className={'btn btn-circle btn-outline btn-info btn-xs flex items-center justify-center border print:hidden'} onClick={openNameModal}>
                <FaPencilAlt />
              </div>
            </div>

            <span>{'-'}</span>
            <span>Kalkulation</span>
          </div>
        )
      }
      actions={[
        <div key={'print-calculation'} className={'btn btn-square btn-outline btn-sm md:btn-md'} onClick={() => window.print()}>
          <FaPrint />
        </div>,
        <button
          key={'save-calculation'}
          disabled={saving}
          className={'btn btn-primary btn-sm md:btn-md'}
          onClick={() => {
            if (saving) return;
            if (id == 'create' && calculationName.trim() == '') {
              openNameModal();
            } else {
              saveCalculationBackend();
            }
          }}
        >
          {saving ? <span className={'loading loading-spinner'} /> : <></>}
          Speichern
        </button>,
      ]}
    >
      {loading ? (
        <PageCenter>
          <Loading />
        </PageCenter>
      ) : (
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 xl:gap-4 print:grid-cols-1'}>
          <div className={'col-span-1 row-span-3 w-full'}>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Getränke Übersicht</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-compact table w-full">
                    <thead>
                      <tr>
                        <th className={'w-20'}>Geplante Menge</th>
                        <th className={'w-full'}>Name</th>
                        {showSalesStuff ? (
                          <>
                            <th className={'w-min'}>Preis</th>
                            <th>Sonderpreis</th>
                          </>
                        ) : (
                          <></>
                        )}
                        <th className={'flex justify-end print:hidden'}>
                          <div
                            className={'btn btn-primary btn-sm'}
                            onClick={() =>
                              modalContext.openModal(
                                <SearchModal
                                  onCocktailSelectedObject={(cocktail) => {
                                    addCocktailToSelection(cocktail.id);
                                  }}
                                />,
                              )
                            }
                          >
                            Hinzufügen
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cocktailCalculationItems.map((cocktail) => (
                        <tr key={'cocktail-' + cocktail.cocktail.id}>
                          <td>
                            <input
                              className={'input input-sm input-bordered w-full print:hidden'}
                              type={'number'}
                              min={1}
                              step={1}
                              value={cocktail.plannedAmount}
                              onChange={(event) => {
                                const updatedItems = cocktailCalculationItems.map((item) => {
                                  if (item.cocktail.id == cocktail.cocktail.id) {
                                    item.plannedAmount = Number(event.target.value);
                                  }
                                  return item;
                                });
                                setCocktailCalculationItems(updatedItems);
                              }}
                            />
                            <div className={'hidden print:flex'}>{cocktail.plannedAmount}</div>
                          </td>
                          <td>{cocktail.cocktail.name}</td>
                          {showSalesStuff ? (
                            <>
                              <td>{cocktail.cocktail.price}</td>
                              <td>
                                <div className={'join print:hidden'}>
                                  <input
                                    type={'number'}
                                className={'input input-sm join-item input-bordered w-20'}
                                    step={0.01}
                                    value={cocktail.customPrice ?? ''}
                                    onChange={(event) => {
                                      const updatedItems = cocktailCalculationItems.map((item) => {
                                        if (item.cocktail.id == cocktail.cocktail.id) {
                                          if (event.target.value == '') {
                                            item.customPrice = undefined;
                                          } else {
                                            item.customPrice = Number(event.target.value);
                                          }
                                        }
                                        return item;
                                      });
                                      setCocktailCalculationItems(updatedItems);
                                    }}
                                  />
                                  <span className={'btn btn-secondary join-item btn-sm'}> €</span>
                                </div>
                                <div className={'hidden print:flex'}>{cocktail.customPrice ?? '-'} €</div>
                              </td>
                            </>
                          ) : (
                            <></>
                          )}
                          <td className={'print:hidden'}>
                            <div className={'flex items-center justify-end'}>
                              <div
                                className={'btn btn-square btn-error btn-sm'}
                                onClick={() => {
                                  modalContext.openModal(
                                    <DeleteConfirmationModal
                                      spelling={'REMOVE'}
                                      onApprove={() => {
                                        setCocktailCalculationItems(cocktailCalculationItems.filter((item) => item.cocktail.id != cocktail.cocktail.id));
                                      }}
                                    />,
                                  );
                                }}
                              >
                                <FaTrashAlt />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className={'col-span-1 w-full'}>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Finanzen</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                  <div className={'form-control'}>
                    <label className={'label'}>
                      <span className={'label-text'}>Betriebswirtschaftliche Ansicht</span>
                    </label>
                    <input
                      checked={showSalesStuff}
                      onChange={(event) => setShowSalesStuff(event.target.checked)}
                      className={'toggle toggle-primary'}
                      type={'checkbox'}
                    />
                  </div>
                </div>
                <div className={'overflow-x-auto'}>
                  <table className={'table-compact table w-full'}>
                    <thead>
                      <tr>
                        <th>Zutat</th>
                        <th>Menge</th>
                        <th>Produktions-Preis</th>
                        <th>Produktion-Summe</th>
                        {showSalesStuff ? (
                          <>
                            <th>Erwarteter Umsatz</th>
                            <th>Erwarteter Gewinn</th>
                          </>
                        ) : (
                          <></>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {cocktailCalculationItems.length == 0 ? (
                        <tr>
                          <td className={'text-center'} colSpan={6}>
                            -
                          </td>
                        </tr>
                      ) : (
                        cocktailCalculationItems
                          .sort((a, b) => a.cocktail.name.localeCompare(b.cocktail.name))
                          .map((cocktail) => (
                            <tr key={'cocktail-' + cocktail.cocktail.id}>
                              <td>{cocktail.cocktail.name}</td>
                              <td>{cocktail.plannedAmount} x</td>
                              <td>{calcCocktailTotalPrice(cocktail.cocktail).toFixed(2)} €</td>
                              <td>{(cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail)).toFixed(2)} €</td>
                              {showSalesStuff ? (
                              <>
                                <td>
                                  {(
                                    cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0)
                                  ).toFixed(2)}
                                  €
                                </td>
                              <td>
                                {(
                                  cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                  cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail)
                                ).toFixed(2)}{' '}
                                €
                              </td>
                              </>
                            ) : (
                              <></>
                            )}
                            </tr>
                          ))
                      )}
                      <tr className={''}></tr>
                      <tr className="bg-base-200">
                        <td className={'font-bold'}>Gesamt</td>
                        <td></td>
                        <td></td>
                        <td>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail))
                            .reduce((acc, curr) => acc + curr, 0)
                            .toFixed(2)}{' '}
                          €
                        </td>
                        {showSalesStuff ? (
                          <>
                            <td>
                              {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0))
                                .reduce((acc, curr) => acc + curr, 0)
                                .toFixed(2)}{' '}
                              €
                            </td>
                            <td>
                              {cocktailCalculationItems
                                .map(
                                  (cocktail) =>
                                    cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                    cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail),
                                )
                                .reduce((acc, curr) => acc + curr, 0)
                                .toFixed(2)}{' '}
                              €
                            </td>
                          </>
                        ) : (
                          <></>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className={'col-span-1 w-full'}>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Einkaufsliste</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                </div>
                <div className={'text-lg font-bold'}>Zutaten</div>
                <div className={'overflow-x-auto'}>
                  <table className={'table-compact table w-full'}>
                    <thead>
                      <tr>
                        <th>Zutat</th>
                        <th>Gesamt Menge</th>
                        <th>Ganze Flaschen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientCalculationItems.length == 0 ? (
                        <tr>
                          <td colSpan={3} className={'text-center'}>
                            Keine Zutaten benötigt
                          </td>
                        </tr>
                      ) : (
                        ingredientCalculationItems
                          .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name))
                          .map((ingredientCalculation) => (
                            <tr key={'ingredientCalculation-' + ingredientCalculation.ingredient.id}>
                              <td>{ingredientCalculation.ingredient.name}</td>
                              <td>
                                {ingredientCalculation.amount.toFixed(2)} {ingredientCalculation.ingredient.unit}
                              </td>
                              <td>
                                {(ingredientCalculation.amount / (ingredientCalculation.ingredient.volume ?? 0)).toFixed(2)}
                                {' (á '}
                                {ingredientCalculation.ingredient.volume} {ingredientCalculation.ingredient.unit})
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={'text-lg font-bold'}>Dekorationen</div>
                <div className={'overflow-x-auto'}>
                  <table className={'table-compact table w-full'}>
                    <thead>
                      <tr>
                        <th>Dekoration</th>
                        <th>Menge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientCalculationItems.length == 0 ? (
                        <tr>
                          <td colSpan={2} className={'text-center'}>
                            Keine Garnituren benötigt
                          </td>
                        </tr>
                      ) : (
                        garnishCalculationItems
                          .sort((a, b) => a.garnish.name.localeCompare(b.garnish.name))
                          .map((garnishCalculationItem) => (
                            <tr key={'garnishCalculation-' + garnishCalculationItem.garnish.id}>
                              <td>{garnishCalculationItem.garnish.name}</td>
                              <td>{garnishCalculationItem.amount.toFixed(0)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManageEntityLayout>
  );
}
