import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { FaInfoCircle, FaPencilAlt, FaPrint, FaSave, FaTrashAlt } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { SearchModal } from '@components/modals/SearchModal';
import { alertService } from '@lib/alertService';
import { calcCocktailTotalPrice } from '@lib/CocktailRecipeCalculation';
import { Garnish, Ingredient, Unit } from '@generated/prisma/client';
import InputModal from '../../../../../components/modals/InputModal';
import { PageCenter } from '@components/layout/PageCenter';
import { Loading } from '@components/Loading';
import { DeleteConfirmationModal } from '@components/modals/DeleteConfirmationModal';
import { UserContext } from '@lib/context/UserContextProvider';
import { IngredientModel } from '../../../../../models/IngredientModel';
import { fetchIngredients } from '@lib/network/ingredients';
import _ from 'lodash';
import { fetchUnits } from '@lib/network/units';
import '../../../../../lib/DateUtils';
import { RoutingContext } from '@lib/context/RoutingContextProvider';

interface CocktailCalculationItem {
  cocktail: CocktailRecipeFull;
  plannedAmount: number;
  customPrice: number | undefined;
}

interface IngredientCalculationItem {
  ingredient: Ingredient;
  amount: number;
  unit: Unit;
}

interface GarnishCalculationItem {
  garnish: Garnish;
  amount: number;
}

interface IngredientShoppingUnit {
  ingredientId: string;
  unitId: string;
  checked: boolean;
}

interface CalculationData {
  name: string;
  showSalesStuff: boolean;
  cocktailCalculationItems: CocktailCalculationItem[];
  ingredientShoppingUnits: IngredientShoppingUnit[];
}

export default function CalculationPage() {
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const routingContext = useContext(RoutingContext);

  const router = useRouter();
  const { id } = router.query;

  const { workspaceId } = router.query;

  const [calculationName, setCalculationName] = useState<string>('');
  const [cocktailCalculationItems, setCocktailCalculationItems] = useState<CocktailCalculationItem[]>([]);

  const [originalItems, setOriginalItems] = useState<string>('[]');
  const [originalName, setOriginalName] = useState<string>('');
  const [originalIngredientShoppingUnits, setOriginalIngredientShoppingUnits] = useState<string>('[]');
  const [originalShowSalesStuff, setOriginalShowSalesStuff] = useState<boolean>(true);

  const [ingredientCalculationItems, setIngredientCalculationItems] = useState<IngredientCalculationItem[]>([]);
  const [garnishCalculationItems, setGarnishCalculationItems] = useState<GarnishCalculationItem[]>([]);

  const [ingredientShoppingUnits, setIngredientShoppingUnits] = useState<IngredientShoppingUnit[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [showSalesStuff, setShowSalesStuff] = useState<boolean>(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientModel[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [shouldSave, triggerSave] = useState(false);
  const [shouldRecalculate, triggerRecalculate] = useState(false);

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, setIngredientsLoading);
    fetchUnits(workspaceId, setUnits, setUnitsLoading);
  }, [workspaceId]);

  /**
   * check for unsaved changes
   */
  useEffect(() => {
    if (
      originalItems != JSON.stringify(cocktailCalculationItems) ||
      originalIngredientShoppingUnits != JSON.stringify(ingredientShoppingUnits) ||
      originalName != calculationName ||
      originalShowSalesStuff != showSalesStuff
    ) {
      setUnsavedChanges(true);
    } else {
      setUnsavedChanges(false);
    }
  }, [
    cocktailCalculationItems,
    originalItems,
    ingredientShoppingUnits,
    originalIngredientShoppingUnits,
    originalName,
    calculationName,
    originalShowSalesStuff,
    showSalesStuff,
  ]);

  // Fetch Calculation
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
          setShowSalesStuff(data.showSalesStuff ?? false);
          setIngredientShoppingUnits(data.ingredientShoppingUnits ?? []);
          setOriginalName(data.name);
          setOriginalItems(JSON.stringify(data.cocktailCalculationItems));
          setOriginalShowSalesStuff(data.showSalesStuff ?? false);
          setOriginalIngredientShoppingUnits(JSON.stringify(data.ingredientShoppingUnits ?? []));
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

  // ShoppingList Cleanup
  const recalculateIngredientShoppingUnits = useCallback(() => {
    const cleanedIngredientShoppingUnits = ingredientShoppingUnits.filter((unit) =>
      ingredientCalculationItems.find((item) => item.ingredient.id == unit.ingredientId),
    );
    setIngredientShoppingUnits(cleanedIngredientShoppingUnits);
  }, [ingredientCalculationItems, ingredientShoppingUnits]);

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
          .finally(() => {
            triggerRecalculate(true);
          });
      }
    },
    [cocktailCalculationItems, workspaceId],
  );

  //Ingredient Calculation
  useEffect(() => {
    let calculationItems: IngredientCalculationItem[] = [];

    cocktailCalculationItems.forEach((item) => {
      item.cocktail.steps.forEach((step) => {
        step.ingredients.forEach((stepIngredient) => {
          if (stepIngredient.ingredient != null) {
            let existingItem = calculationItems.find(
              (calculationItem) => calculationItem.ingredient.id == stepIngredient.ingredientId && calculationItem.unit.id == stepIngredient.unitId,
            );
            if (existingItem) {
              existingItem.amount += (stepIngredient.amount ?? 0) * item.plannedAmount;
              calculationItems = [...calculationItems.filter((item) => item.ingredient.id != existingItem?.ingredient.id), existingItem];
            } else {
              calculationItems.push({
                ingredient: stepIngredient.ingredient,
                amount: (stepIngredient.amount ?? 0) * item.plannedAmount,
                unit: stepIngredient.unit!,
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

      const currentScrollTop = window.scrollY;

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
          ingredientShoppingUnits: ingredientShoppingUnits,
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
              setOriginalShowSalesStuff(showSalesStuff);
              setOriginalName(calculationName);
              setOriginalIngredientShoppingUnits(JSON.stringify(ingredientShoppingUnits));
              if (redirect) {
                await router.replace(`/workspaces/${workspaceId}/manage/calculations/${body.data.id}`);
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
            window.scrollTo(0, currentScrollTop);
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
          ingredientShoppingUnits: ingredientShoppingUnits,
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
              setOriginalShowSalesStuff(showSalesStuff);
              setOriginalName(calculationName);
              setOriginalIngredientShoppingUnits(JSON.stringify(ingredientShoppingUnits));
              if (redirect) {
                await router.replace(`/workspaces/${workspaceId}/manage/calculations/${body.data.id}`);
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
            window.scrollTo(0, currentScrollTop);
          });
      }
    },
    [ingredientShoppingUnits, id, calculationName, showSalesStuff, cocktailCalculationItems, workspaceId, router],
  );

  useEffect(() => {
    if (shouldSave) {
      saveCalculationBackend();
      triggerSave(false);
    }
  }, [shouldSave, saveCalculationBackend]);

  useEffect(() => {
    if (shouldRecalculate) {
      recalculateIngredientShoppingUnits();
      triggerRecalculate(false);
    }
  }, [shouldRecalculate, recalculateIngredientShoppingUnits]);

  useEffect(() => {
    if (!id) return;
    if (!calculationName) return;

    if (id == 'create') {
      saveCalculationBackend();
    }
  }, [calculationName, id, saveCalculationBackend]);

  const openNameModal = useCallback(() => {
    modalContext.openModal(
      <InputModal title={'Kalkulation speichern'} onInputSubmit={async (value) => setCalculationName(value)} defaultValue={calculationName} />,
    );
  }, [calculationName, modalContext]);

  // All must have the same ingredient
  const calculateTotalIngredientAmount = useCallback(
    (items: IngredientCalculationItem[]) => {
      return (
        items.reduce(
          (acc, curr) =>
            acc +
            curr.amount /
              (ingredients.find((ingredient) => ingredient.id == curr.ingredient.id)?.IngredientVolume?.find((volume) => volume.unitId == curr.unit.id)
                ?.volume ?? 0),
          0,
        ) *
        (ingredients
          .find((ingredient) => ingredient.id == items[0].ingredient.id)
          ?.IngredientVolume?.find(
            (volume) => volume.unitId == ingredientShoppingUnits.find((ingredient) => ingredient.ingredientId == items[0].ingredient.id)?.unitId,
          )?.volume ?? 0)
      );
    },
    [ingredientShoppingUnits, ingredients],
  );

  const calculateTotalIngredientAmountByUnit = useCallback(
    (ingredientId: string): number | undefined => {
      return _.chain(ingredientCalculationItems)
        .groupBy('ingredient.id')
        .filter((items, key) => key == ingredientId)
        .map((items) =>
          items.reduce(
            (acc, curr) =>
              acc +
              curr.amount /
                (ingredients.find((ingredient) => ingredient.id == curr.ingredient.id)?.IngredientVolume?.find((volume) => volume.unitId == curr.unit.id)
                  ?.volume ?? 0),
            0,
          ),
        )
        .value()
        .at(0);
    },
    [ingredientCalculationItems, ingredients],
  );

  const calculateRecommendedAmount = useCallback(
    (calculationItem: CocktailCalculationItem) => {
      const summedIngredientPerCocktails: { ingredient: any; amountInPercent: number }[] = [];
      calculationItem.cocktail.steps
        .flatMap((step) => step.ingredients)
        .forEach((stepIngredient) => {
          const existingItem = summedIngredientPerCocktails.find((item) => item.ingredient.id == stepIngredient.ingredientId);
          if (existingItem) {
            existingItem.amountInPercent +=
              (stepIngredient.amount ?? 0) /
              (ingredients
                .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                ?.IngredientVolume.find((volume) => volume.unitId == stepIngredient.unitId)?.volume ?? 1);
          } else {
            summedIngredientPerCocktails.push({
              ingredient: stepIngredient.ingredient,
              amountInPercent:
                (stepIngredient.amount ?? 0) /
                (ingredients
                  .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                  ?.IngredientVolume.find((volume) => volume.unitId == stepIngredient.unitId)?.volume ?? 1),
            });
          }
        });

      return summedIngredientPerCocktails.map((summedIngredientPerCocktail) => {
        let ingredient = summedIngredientPerCocktail.ingredient;

        const totalNeededBottles = Math.ceil(calculateTotalIngredientAmountByUnit(ingredient.id) ?? 0);
        const totalNeededAmount = calculateTotalIngredientAmountByUnit(ingredient.id) ?? 0;
        let cocktailIngredientAmount = summedIngredientPerCocktail.amountInPercent;

        return {
          ingredient: ingredient,
          more: Math.floor((totalNeededBottles - totalNeededAmount) / cocktailIngredientAmount),
          less: Math.ceil((totalNeededBottles - 1 - totalNeededAmount) / cocktailIngredientAmount),
        };
      });
    },
    [calculateTotalIngredientAmountByUnit, ingredients],
  );

  const handleCSVExport = useCallback(() => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Markiert,Name,Geplante Menge,Einheit\n' +
      _.chain(ingredientCalculationItems)
        .groupBy('ingredient.id')
        .sortBy((group) => group[0].ingredient.name)
        .map(
          (items, key) =>
            `${ingredientShoppingUnits.find((ingredient) => ingredient.ingredientId == items[0].ingredient.id)?.checked ? 'true' : 'false'},${items[0].ingredient.name},${calculateTotalIngredientAmount(
              items,
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })},${userContext.getTranslation(
              units.find((unit) => unit.id == ingredientShoppingUnits.find((ingredient) => ingredient.ingredientId == items[0].ingredient.id)?.unitId)?.name ??
                'N/A',
              'de',
            )}`,
        )
        .value()
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'cocktail-calculation.csv');
    document.body.appendChild(link);
    link.click();
  }, [calculateTotalIngredientAmount, ingredientCalculationItems, ingredientShoppingUnits, units, userContext]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/calculations`}
      unsavedChanges={unsavedChanges}
      onSave={async () => {
        if (id == 'create' && calculationName.trim() == '') {
          openNameModal();
        } else {
          saveCalculationBackend(false);
          await routingContext.conditionalBack(`/workspaces/${workspaceId}/manage/calculations`);
        }
      }}
      title={
        calculationName.trim() == '' ? (
          'Kalkulation'
        ) : (
          <div className={'flex flex-col items-center justify-center md:flex-row md:gap-2 print:flex-row'}>
            <div className={'flex'}>
              <div>{calculationName}</div>
              <div className={'btn btn-circle btn-outline btn-info btn-xs flex items-center justify-center border print:hidden'} onClick={openNameModal}>
                <FaPencilAlt />
              </div>
            </div>

            <span>{'-'}</span>
            <span>Kalkulation</span>
            <div className={'hidden print:flex'}>({new Date().toFormatDateString()})</div>
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
      {loading || ingredientsLoading || unitsLoading ? (
        <PageCenter>
          <Loading />
        </PageCenter>
      ) : (
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 xl:gap-4 print:grid-cols-1 print:gap-1'}>
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
                        <th className={'print:hidden'}>Mengenvorschläge</th>
                        {showSalesStuff ? (
                          <>
                            <th className={'min-w-20'}>Preis</th>
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
                      {cocktailCalculationItems.length == 0 ? (
                        <tr className={'text-center'}>
                          <td colSpan={4 + (showSalesStuff ? 1 : 0)}>Keine Einträge vorhanden</td>
                        </tr>
                      ) : (
                        cocktailCalculationItems.map((cocktail) => (
                          <tr key={'cocktail-' + cocktail.cocktail.id}>
                            <td>
                              <input
                                className={'input input-sm w-full print:hidden'}
                                type={'number'}
                                min={1}
                                step={1}
                                value={cocktail.plannedAmount}
                                onChange={(event) => {
                                  const updatedItems = cocktailCalculationItems.map((item) => {
                                    if (item.cocktail.id == cocktail.cocktail.id) {
                                      if (Number(event.target.value) < 0) {
                                        item.plannedAmount = 0;
                                      } else {
                                        item.plannedAmount = Number(event.target.value);
                                      }
                                    }
                                    return item;
                                  });
                                  setCocktailCalculationItems(updatedItems);
                                }}
                              />
                              <div className={'hidden print:flex'}>{cocktail.plannedAmount}</div>
                            </td>
                            <td className={'items-center'}>
                              <span className={'font-bold'}>{cocktail.cocktail.name}</span>
                            </td>
                            <td className={'print:hidden'}>
                              <button
                                onClick={() => {
                                  modalContext.openModal(
                                    <div className={'flex flex-col gap-2'}>
                                      <div className={'card-title'}>Mengenvorschläge</div>
                                      <div>
                                        Wie viel Einheiten noch benötigt werden, um die Zutat vollständig zu benutzen (links, in grün) und (rechts, in rot) wie
                                        viel weniger Einheiten, um die angebrochene Auszugleichen.
                                      </div>
                                      <div className={'divider font-bold'}>Zutaten</div>
                                      <div className={'grid grid-cols-3 items-center gap-2'}>
                                        {calculateRecommendedAmount(cocktail)
                                          .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name))
                                          .map((item, index) => (
                                            <>
                                              <span key={`cocktail-${cocktail.cocktail.id}-ingredient-${index}-name`}>{item.ingredient.name}</span>
                                              <span
                                                key={`cocktail-${cocktail.cocktail.id}-ingredient-${index}-more`}
                                                className={'btn btn-outline btn-sm text-green-500'}
                                                onClick={() => {
                                                  const temp = cocktailCalculationItems.map((calcItem) => {
                                                    if (calcItem.cocktail.id == cocktail.cocktail.id) {
                                                      calcItem.plannedAmount += Math.floor(item.more);
                                                    }
                                                    return calcItem;
                                                  });
                                                  setCocktailCalculationItems(temp);

                                                  modalContext.closeModal();
                                                }}
                                              >
                                                + {Math.floor(item.more)} Anpassen
                                              </span>
                                              <button
                                                key={`cocktail-${cocktail.cocktail.id}-ingredient-${index}-less`}
                                                className={'btn btn-outline btn-sm text-red-500'}
                                                disabled={
                                                  (cocktailCalculationItems.find((cocktailItem) => cocktailItem.cocktail.id == cocktail.cocktail.id)
                                                    ?.plannedAmount ?? 0) +
                                                    Math.floor(item.less) <
                                                  0
                                                }
                                                onClick={() => {
                                                  const temp = cocktailCalculationItems.map((calcItem) => {
                                                    if (calcItem.cocktail.id == cocktail.cocktail.id) {
                                                      calcItem.plannedAmount += Math.floor(item.less);
                                                    }
                                                    return calcItem;
                                                  });
                                                  setCocktailCalculationItems(temp);

                                                  modalContext.closeModal();
                                                }}
                                              >
                                                {Math.floor(item.less)} Anpassen
                                              </button>
                                            </>
                                          ))}
                                      </div>
                                    </div>,
                                  );
                                }}
                                className={'btn-ghoast btn btn-sm'}
                              >
                                <FaInfoCircle />
                                <span>Anzeigen</span>
                              </button>
                            </td>
                            {showSalesStuff ? (
                              <>
                                <td>
                                  <span>{`${
                                    cocktail.cocktail.price?.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    }) ?? '-'
                                  } €`}</span>
                                </td>
                                <td>
                                  <div className={'join print:hidden'}>
                                    <input
                                      type={'number'}
                                      className={'input input-sm join-item w-20'}
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
                                  <div className={'hidden print:flex'}>
                                    {cocktail.customPrice?.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    }) ?? '-'}{' '}
                                    €
                                  </div>
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
                                        entityName={`den Cocktail '${cocktail.cocktail.name}'`}
                                        onApprove={async () => {
                                          setCocktailCalculationItems(cocktailCalculationItems.filter((item) => item.cocktail.id != cocktail.cocktail.id));
                                          triggerRecalculate(true);
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
                        ))
                      )}
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
                              <td>
                                {calcCocktailTotalPrice(cocktail.cocktail, ingredients).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                €
                              </td>
                              <td>
                                {(cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients)).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                €
                              </td>
                              {showSalesStuff ? (
                                <>
                                  <td>
                                    {(cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0)).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                    €
                                  </td>
                                  <td>
                                    {(
                                      cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                      cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients)
                                    ).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
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
                        <td>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount)
                            .reduce((acc, curr) => acc + curr, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                          x
                        </td>
                        <td></td>
                        <td>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients))
                            .reduce((acc, curr) => acc + curr, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                          €
                        </td>
                        {showSalesStuff ? (
                          <>
                            <td>
                              {cocktailCalculationItems
                                .map((cocktail) => cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0))
                                .reduce((acc, curr) => acc + curr, 0)
                                .toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                              €
                            </td>
                            <td>
                              {cocktailCalculationItems
                                .map(
                                  (cocktail) =>
                                    cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                    cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients),
                                )
                                .reduce((acc, curr) => acc + curr, 0)
                                .toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
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
                <div className={'flex items-center justify-between'}>
                  <div className={'text-lg font-bold'}>Zutaten</div>
                  <div className={'btn btn-outline btn-sm'} onClick={handleCSVExport}>
                    <FaSave />
                    Als CSV exportieren
                  </div>
                </div>
                <div className={'overflow-x-auto'}>
                  <table className={'table-compact table w-full'}>
                    <thead>
                      <tr>
                        <th className={'w-6'}>
                          <div className="tooltip tooltip-right tooltip-info before:max-w-fit" data-tip={'Diese Kästchen sollen z.B. beim Einkaufen helfen'}>
                            <FaInfoCircle />
                          </div>
                        </th>
                        <th>Zutat</th>
                        <th>Gesamt Menge</th>
                        <th className={'print:hidden'}>Ausgabe Einheit</th>
                        <th>Anzahl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientCalculationItems.length == 0 ? (
                        <tr>
                          <td colSpan={5} className={'text-center'}>
                            Keine Zutaten benötigt
                          </td>
                        </tr>
                      ) : (
                        _.chain(ingredientCalculationItems)
                          .groupBy('ingredient.id')
                          .sortBy((group) => group[0].ingredient.name)
                          .map((items, key) => (
                            <tr key={`shopping-ingredient-${key}`}>
                              <td>
                                <input
                                  key={`shopping-ingredient-${key}-checkbox-${items[0].ingredient.id}`}
                                  type="checkbox"
                                  className={'checkbox checkbox-sm w-min justify-self-center'}
                                  disabled={
                                    ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id) == undefined ||
                                    ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id)?.unitId == ''
                                  }
                                  onChange={(event) => {
                                    const updatedItems = ingredientShoppingUnits.filter((item) => item.ingredientId != items[0].ingredient.id);
                                    updatedItems.push({
                                      ingredientId: items[0].ingredient.id,
                                      unitId: ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id)?.unitId ?? '',
                                      checked: event.target.checked,
                                    });
                                    setIngredientShoppingUnits(updatedItems);
                                    if (id != 'create') {
                                      triggerSave(true);
                                    }
                                  }}
                                  defaultChecked={
                                    ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id) == undefined ||
                                    ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id)?.unitId == ''
                                      ? false
                                      : ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id)?.checked
                                  }
                                />
                              </td>
                              <td>{items[0].ingredient.name}</td>
                              <td className={'flex flex-col'}>
                                {items.map((item) => (
                                  <div key={`shopping-ingredient-${key}-unit-${item.unit.id}`}>
                                    {item.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {userContext.getTranslation(item.unit.name ?? 'N/A', 'de')}
                                  </div>
                                ))}
                              </td>
                              <td className={'print:hidden'}>
                                <select
                                  className={'select select-sm'}
                                  value={
                                    ingredientShoppingUnits.find((ingredientShoppingUnit) => ingredientShoppingUnit.ingredientId == items[0].ingredient.id)
                                      ?.unitId ??
                                    // if only one unit is available, select it
                                    (ingredients.find((ingredient) => ingredient.id == items[0].ingredient.id)?.IngredientVolume.length == 1
                                      ? ingredients.find((ingredient) => ingredient.id == items[0].ingredient.id)?.IngredientVolume[0].unitId
                                      : '')
                                  }
                                  onChange={(event) => {
                                    const updatedItems = ingredientShoppingUnits.filter((item) => item.ingredientId != items[0].ingredient.id);
                                    updatedItems.push({
                                      ingredientId: items[0].ingredient.id,
                                      unitId: event.target.value,
                                      checked: ingredientShoppingUnits.find((item) => item.ingredientId == items[0].ingredient.id)?.checked ?? false,
                                    });
                                    setIngredientShoppingUnits(updatedItems);
                                  }}
                                >
                                  <option value={''} disabled={true}>
                                    Auswählen
                                  </option>
                                  {ingredients
                                    .find((ingredient) => ingredient.id == items[0].ingredient.id)
                                    ?.IngredientVolume.map((unit) => (
                                      <option key={`ingredientCalculation-${items[0].ingredient.id}-output-unit-${unit.unitId}`} value={unit.unitId}>
                                        {userContext.getTranslation(unit.unit.name ?? 'N/A', 'de')}
                                      </option>
                                    ))}
                                </select>
                              </td>
                              <td>
                                {calculateTotalIngredientAmount(items).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {userContext.getTranslation(
                                  units.find(
                                    (unit) =>
                                      unit.id == ingredientShoppingUnits.find((ingredient) => ingredient.ingredientId == items[0].ingredient.id)?.unitId,
                                  )?.name ?? 'N/A',
                                  'de',
                                )}
                              </td>
                            </tr>
                          ))
                          .value()
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={'text-lg font-bold'}>Garnituren</div>
                <div className={'overflow-x-auto'}>
                  <table className={'table-compact table w-full'}>
                    <thead>
                      <tr>
                        <th>Garnitur</th>
                        <th>Menge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {garnishCalculationItems.length == 0 ? (
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
                              <td>
                                {garnishCalculationItem.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}
                              </td>
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
