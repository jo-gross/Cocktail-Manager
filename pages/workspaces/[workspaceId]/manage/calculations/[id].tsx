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
          setCalculationName(body.data.name);
          setCocktailCalculationItems(body.data.cocktailCalculationItems);
          setOriginalItems(JSON.stringify(body.data.cocktailCalculationItems));
        } else {
          console.log('CocktailCalculation -> useEffect[init, id != create]', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
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
              setCocktailCalculationItems([
                ...cocktailCalculationItems,
                { cocktail: body.data, plannedAmount: 1, customPrice: undefined },
              ]);
            } else {
              console.log('CocktailId -> fetchRecipe', response, body);
              alertService.error(body.message, response.status, response.statusText);
            }
          })
          .catch((err) => alertService.error(err.message))
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
            let existingItem = calculationItems.find(
              (calculationItem) => calculationItem.ingredient.id == ingredient.ingredientId,
            );
            if (existingItem) {
              existingItem.amount += (ingredient.amount ?? 0) * item.plannedAmount;
              calculationItems = [
                ...calculationItems.filter((item) => item.ingredient.id != existingItem?.ingredient.id),
                existingItem,
              ];
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
          calculationItems = [
            ...calculationItems.filter((item) => item.garnish.id != existingItem?.garnish.id),
            existingItem,
          ];
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

      if (id == 'create') {
        const body = {
          name: calculationName,
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
              console.log('CocktailCalculation -> useEffect[create, name]', response, body);
              alertService.error(body.message, response.status, response.statusText);
            }
          })
          .catch((err) => alertService.error(err.message))
          .finally(() => {});
      } else {
        const body = {
          name: calculationName,
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
              console.log('CocktailCalculation -> useEffect[create, name]', response, body);
              alertService.error(body.message, response.status, response.statusText);
            }
          })
          .catch((err) => alertService.error(err.message))
          .finally(() => {});
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
    modalContext.openModal(
      <InputModal
        title={'Kalkulation speichern'}
        onInputChange={(value) => setCalculationName(value)}
        defaultValue={calculationName}
      />,
    );
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
          <div className={'flex flex-row'}>
            <span>{calculationName}</span>
            <div
              className={
                'btn btn-xs btn-outline btn-circle btn-info border flex items-center justify-center print:hidden'
              }
              onClick={openNameModal}
            >
              <FaPencilAlt />
            </div>
            <span> - Kalkulation</span>
          </div>
        )
      }
      actions={[
        <div
          key={'print-calculation'}
          className={'btn btn-outline btn-square md:btn-md btn-sm'}
          onClick={() => window.print()}
        >
          <FaPrint />
        </div>,
        <div
          key={'save-calculation'}
          className={'btn btn-primary md:btn-md btn-sm'}
          onClick={() => {
            if (id == 'create' && calculationName.trim() == '') {
              openNameModal();
            } else {
              saveCalculationBackend();
            }
          }}
        >
          Speichern
        </div>,
      ]}
    >
      {loading ? (
        <PageCenter>
          <Loading />
        </PageCenter>
      ) : (
        <div className={'grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 xl:gap-4 gap-2 print:grid-cols-1'}>
          <div className={'md:col-span-2 col-span-1 row-span-3 w-full print:col-span-1'}>
            <div className={'card'}>
              <div className={'card-body'}>
                <div className={'text-2xl font-bold text-center print:text-xl'}>Getränke Übersicht</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th className={'w-20'}>Geplante Menge</th>
                        <th className={'w-full'}>Name</th>
                        <th className={'w-min'}>Preis</th>
                        <th>Sonderpreis</th>
                        <th className={'flex justify-end print:hidden'}>
                          <div
                            className={'btn btn-sm btn-primary'}
                            onClick={() =>
                              modalContext.openModal(
                                <SearchModal
                                  onCocktailSelected={(id) => {
                                    addCocktailToSelection(id);
                                  }}
                                ></SearchModal>,
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
                              className={'input input-bordered input-sm w-full print:hidden'}
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
                          <td>{cocktail.cocktail.price}</td>
                          <td>
                            <div className={'input-group print:hidden'}>
                              <input
                                type={'number'}
                                className={'input input-bordered input-sm w-20'}
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
                              <span className={'input-group-text bg-secondary border border-secondary'}> €</span>
                            </div>
                            <div className={'hidden print:flex'}>{cocktail.customPrice ?? '-'} €</div>
                          </td>
                          <td className={'flex justify-end items-center print:hidden'}>
                            <div
                              className={'btn btn-sm btn-error'}
                              onClick={() => {
                                modalContext.openModal(
                                  <DeleteConfirmationModal
                                    spelling={'REMOVE'}
                                    onApprove={() => {
                                      setCocktailCalculationItems(
                                        cocktailCalculationItems.filter(
                                          (item) => item.cocktail.id != cocktail.cocktail.id,
                                        ),
                                      );
                                    }}
                                  />,
                                );
                              }}
                            >
                              <FaTrashAlt />
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
                <div className={'text-2xl font-bold text-center print:text-xl'}>Finanzen</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                </div>
                <div className={'overflow-x-auto'}>
                  <table className={'table table-compact w-full'}>
                    <thead>
                      <tr>
                        <th>Zutat</th>
                        <th>Menge</th>
                        <th>Produktions-Preis</th>
                        <th>Produktion-Summe</th>
                        <th>Erwarteter Umsatz</th>
                        <th>Erwarteter Gewinn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cocktailCalculationItems
                        .sort((a, b) => a.cocktail.name.localeCompare(b.cocktail.name))
                        .map((cocktail) => (
                          <tr key={'cocktail-' + cocktail.cocktail.id}>
                            <td>{cocktail.cocktail.name}</td>
                            <td>{cocktail.plannedAmount} x</td>
                            <td>{calcCocktailTotalPrice(cocktail.cocktail).toFixed(2)} €</td>
                            <td>{(cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail)).toFixed(2)} €</td>
                            <td>
                              {(
                                cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0)
                              ).toFixed(2)}{' '}
                              €
                            </td>
                            <td>
                              {(
                                cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail)
                              ).toFixed(2)}{' '}
                              €
                            </td>
                          </tr>
                        ))}
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
                        <td>
                          {cocktailCalculationItems
                            .map(
                              (cocktail) =>
                                cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0),
                            )
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
                <div className={'text-2xl font-bold text-center print:text-xl'}>Einkaufsliste</div>
                <div className={'print:hidden'}>
                  <div className={'divider-sm'}></div>
                </div>
                <div className={'font-bold text-lg'}>Zutaten</div>
                <div className={'overflow-x-auto'}>
                  <table className={'table table-compact w-full'}>
                    <thead>
                      <tr>
                        <th>Zutat</th>
                        <th>Menge</th>
                        <th>Ganze Flaschen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientCalculationItems
                        .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name))
                        .map((ingredientCalculation) => (
                          <tr key={'ingredientCalculation-' + ingredientCalculation.ingredient.id}>
                            <td>{ingredientCalculation.ingredient.name}</td>
                            <td>
                              {ingredientCalculation.amount.toFixed(2)} {ingredientCalculation.ingredient.unit}
                            </td>
                            <td>
                              {(ingredientCalculation.amount / (ingredientCalculation.ingredient.volume ?? 0)).toFixed(
                                2,
                              )}
                              {' (á '}
                              {ingredientCalculation.ingredient.volume} {ingredientCalculation.ingredient.unit})
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className={'font-bold text-lg'}>Dekorationen</div>
                <div className={'overflow-x-auto'}>
                  <table className={'table table-compact w-full'}>
                    <thead>
                      <tr>
                        <th>Dekoration</th>
                        <th>Menge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {garnishCalculationItems
                        .sort((a, b) => a.garnish.name.localeCompare(b.garnish.name))
                        .map((garnishCalculationItem) => (
                          <tr key={'garnishCalculation-' + garnishCalculationItem.garnish.id}>
                            <td>{garnishCalculationItem.garnish.name}</td>
                            <td>{garnishCalculationItem.amount.toFixed(0)}</td>
                          </tr>
                        ))}
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
