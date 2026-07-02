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
import { formatDate } from '@lib/DateUtils';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import '../../../../../lib/NumberUtils';
import {
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Checkbox,
  Divider,
  FormControl,
  Input,
  Label,
  LabelText,
  Loading as UiLoading,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Toggle,
  Tooltip,
} from '@components/ui';

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
            const existingItem = calculationItems.find(
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
      item.cocktail.garnishes
        .filter((g) => !(g as unknown as { isAlternative?: boolean }).isAlternative)
        .forEach((garnish) => {
          const existingItem = calculationItems.find((calculationItem) => calculationItem.garnish.id == garnish.garnishId);
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
    [
      ingredientShoppingUnits,
      id,
      calculationName,
      showSalesStuff,
      cocktailCalculationItems,
      workspaceId,
      router,
      originalItems,
      originalIngredientShoppingUnits,
      originalName,
      originalShowSalesStuff,
    ],
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
      const summedIngredientPerCocktails: { ingredient: Ingredient; amountInPercent: number }[] = [];
      calculationItem.cocktail.steps
        .flatMap((step) => step.ingredients)
        .filter((stepIngredient) => stepIngredient.ingredient != null)
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
              ingredient: stepIngredient.ingredient!,
              amountInPercent:
                (stepIngredient.amount ?? 0) /
                (ingredients
                  .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                  ?.IngredientVolume.find((volume) => volume.unitId == stepIngredient.unitId)?.volume ?? 1),
            });
          }
        });

      return summedIngredientPerCocktails.map((summedIngredientPerCocktail) => {
        const ingredient = summedIngredientPerCocktail.ingredient;

        const totalNeededBottles = Math.ceil(calculateTotalIngredientAmountByUnit(ingredient.id) ?? 0);
        const totalNeededAmount = calculateTotalIngredientAmountByUnit(ingredient.id) ?? 0;
        const cocktailIngredientAmount = summedIngredientPerCocktail.amountInPercent;

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
          (items, _key) =>
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
              <Button
                type="button"
                variant="outline"
                shape="circle"
                size="xs"
                className="border-info text-info hover:bg-info/10 print:hidden"
                onClick={openNameModal}
              >
                <FaPencilAlt />
              </Button>
            </div>

            <span>{'-'}</span>
            <span>Kalkulation</span>
            <div className={'hidden print:flex'}>({formatDate(new Date())})</div>
          </div>
        )
      }
      actions={[
        <Button key={'print-calculation'} type="button" variant="outline" shape="square" size="sm" className="md:h-10 md:w-10" onClick={() => window.print()}>
          <FaPrint />
        </Button>,
        <Button
          key={'save-calculation'}
          type="button"
          variant="primary"
          size="sm"
          className="md:h-10"
          disabled={saving}
          onClick={() => {
            if (saving) return;
            if (id == 'create' && calculationName.trim() == '') {
              openNameModal();
            } else {
              saveCalculationBackend();
            }
          }}
        >
          {saving ? <UiLoading size="sm" /> : null}
          Speichern
        </Button>,
      ]}
    >
      {loading || ingredientsLoading || unitsLoading ? (
        <PageCenter>
          <Loading />
        </PageCenter>
      ) : (
        <div className={'grid grid-cols-1 gap-2 md:grid-cols-2 xl:gap-4 print:grid-cols-1 print:gap-1'}>
          <div className={'col-span-1 row-span-3 w-full'}>
            <Card>
              <CardBody>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Getränke Übersicht</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                </div>
                <div className="overflow-x-auto">
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-20">Geplante Menge</TableHeaderCell>
                        <TableHeaderCell className="w-full">Name</TableHeaderCell>
                        <TableHeaderCell className="print:hidden">Mengenvorschläge</TableHeaderCell>
                        {showSalesStuff ? (
                          <>
                            <TableHeaderCell className="min-w-20">Preis</TableHeaderCell>
                            <TableHeaderCell>Sonderpreis</TableHeaderCell>
                          </>
                        ) : null}
                        <TableHeaderCell className="flex justify-end print:hidden">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
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
                          </Button>
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cocktailCalculationItems.length == 0 ? (
                        <TableRow className="text-center">
                          <TableCell colSpan={showSalesStuff ? 6 : 4}>Keine Einträge vorhanden</TableCell>
                        </TableRow>
                      ) : (
                        cocktailCalculationItems.map((cocktail) => (
                          <TableRow key={'cocktail-' + cocktail.cocktail.id}>
                            <TableCell>
                              <Input
                                inputSize="sm"
                                className="w-full print:hidden"
                                type="number"
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
                              <div className="hidden print:flex">{cocktail.plannedAmount}</div>
                            </TableCell>
                            <TableCell className="items-center">
                              <span className="font-bold">{cocktail.cocktail.name}</span>
                            </TableCell>
                            <TableCell className="print:hidden">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  modalContext.openModal(
                                    <div className="flex flex-col gap-2">
                                      <div className="text-lg font-semibold">Mengenvorschläge</div>
                                      <div>
                                        Wie viel Einheiten noch benötigt werden, um die Zutat vollständig zu benutzen (links, in grün) und (rechts, in rot) wie
                                        viel weniger Einheiten, um die angebrochene Auszugleichen.
                                      </div>
                                      <Divider className="font-bold">Zutaten</Divider>
                                      <div className="grid grid-cols-3 items-center gap-2">
                                        {calculateRecommendedAmount(cocktail)
                                          .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name))
                                          .map((item, index) => (
                                            <React.Fragment key={`cocktail-${cocktail.cocktail.id}-ingredient-${index}`}>
                                              <span>{item.ingredient.name}</span>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-green-500"
                                                onClick={() => {
                                                  const temp = cocktailCalculationItems.map((calcItem) => {
                                                    if (calcItem.cocktail.id == cocktail.cocktail.id) {
                                                      calcItem.plannedAmount += Math.floor(item.more);
                                                    }
                                                    return calcItem;
                                                  });
                                                  setCocktailCalculationItems(temp);
                                                  modalContext.closeAllModals();
                                                }}
                                              >
                                                + {Math.floor(item.more)} Anpassen
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-red-500"
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
                                                  modalContext.closeAllModals();
                                                }}
                                              >
                                                {Math.floor(item.less)} Anpassen
                                              </Button>
                                            </React.Fragment>
                                          ))}
                                      </div>
                                    </div>,
                                  );
                                }}
                              >
                                <FaInfoCircle />
                                <span>Anzeigen</span>
                              </Button>
                            </TableCell>
                            {showSalesStuff ? (
                              <>
                                <TableCell>
                                  <span>{`${cocktail.cocktail.price?.formatPrice() ?? '-'} €`}</span>
                                </TableCell>
                                <TableCell>
                                  <ButtonGroup className="print:hidden">
                                    <Input
                                      type="number"
                                      inputSize="sm"
                                      joinItem
                                      className="w-20"
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
                                    <Button type="button" variant="secondary" joinItem size="sm" tabIndex={-1}>
                                      €
                                    </Button>
                                  </ButtonGroup>
                                  <div className="hidden print:flex">{cocktail.customPrice?.formatPrice() ?? '-'} €</div>
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell className="print:hidden">
                              <div className="flex items-center justify-end">
                                <Button
                                  type="button"
                                  variant="error"
                                  shape="square"
                                  size="sm"
                                  onClick={() => {
                                    modalContext.openModal(
                                      <DeleteConfirmationModal
                                        spelling="REMOVE"
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
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
          <div className={'col-span-1 w-full'}>
            <Card>
              <CardBody>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Finanzen</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                  <FormControl>
                    <Label className="flex-row items-center justify-between">
                      <LabelText>Betriebswirtschaftliche Ansicht</LabelText>
                      <Toggle checked={showSalesStuff} onChange={(event) => setShowSalesStuff(event.target.checked)} />
                    </Label>
                  </FormControl>
                </div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Zutat</TableHeaderCell>
                        <TableHeaderCell>Menge</TableHeaderCell>
                        <TableHeaderCell>Produktions-Preis</TableHeaderCell>
                        <TableHeaderCell>Produktion-Summe</TableHeaderCell>
                        {showSalesStuff ? (
                          <>
                            <TableHeaderCell>Erwarteter Umsatz</TableHeaderCell>
                            <TableHeaderCell>Erwarteter Gewinn</TableHeaderCell>
                          </>
                        ) : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cocktailCalculationItems.length == 0 ? (
                        <TableRow>
                          <TableCell className="text-center" colSpan={showSalesStuff ? 6 : 4}>
                            -
                          </TableCell>
                        </TableRow>
                      ) : (
                        cocktailCalculationItems
                          .sort((a, b) => a.cocktail.name.localeCompare(b.cocktail.name))
                          .map((cocktail) => (
                            <TableRow key={'cocktail-' + cocktail.cocktail.id}>
                              <TableCell>{cocktail.cocktail.name}</TableCell>
                              <TableCell>{cocktail.plannedAmount} x</TableCell>
                              <TableCell>{calcCocktailTotalPrice(cocktail.cocktail, ingredients).formatPrice()} €</TableCell>
                              <TableCell>{(cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients)).formatPrice()} €</TableCell>
                              {showSalesStuff ? (
                                <>
                                  <TableCell>{(cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0)).formatPrice()}€</TableCell>
                                  <TableCell>
                                    {(
                                      cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                      cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients)
                                    ).formatPrice()}{' '}
                                    €
                                  </TableCell>
                                </>
                              ) : null}
                            </TableRow>
                          ))
                      )}
                      <TableRow />
                      <TableRow className="bg-base-200">
                        <TableCell className="font-bold">Gesamt</TableCell>
                        <TableCell>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount)
                            .reduce((acc, curr) => acc + curr, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                          x
                        </TableCell>
                        <TableCell />
                        <TableCell>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients))
                            .reduce((acc, curr) => acc + curr, 0)
                            .formatPrice()}{' '}
                          €
                        </TableCell>
                        {showSalesStuff ? (
                          <>
                            <TableCell>
                              {cocktailCalculationItems
                                .map((cocktail) => cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0))
                                .reduce((acc, curr) => acc + curr, 0)
                                .formatPrice()}{' '}
                              €
                            </TableCell>
                            <TableCell>
                              {cocktailCalculationItems
                                .map(
                                  (cocktail) =>
                                    cocktail.plannedAmount * (cocktail.customPrice ?? cocktail.cocktail.price ?? 0) -
                                    cocktail.plannedAmount * calcCocktailTotalPrice(cocktail.cocktail, ingredients),
                                )
                                .reduce((acc, curr) => acc + curr, 0)
                                .formatPrice()}{' '}
                              €
                            </TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
          <div className={'col-span-1 w-full'}>
            <Card>
              <CardBody>
                <div className={'text-center text-2xl font-bold print:text-xl'}>Einkaufsliste</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                </div>
                <div className={'flex items-center justify-between'}>
                  <div className={'text-lg font-bold'}>Zutaten</div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCSVExport}>
                    <FaSave />
                    Als CSV exportieren
                  </Button>
                </div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-0">
                          <Tooltip tip="Diese Kästchen sollen z.B. beim Einkaufen helfen">
                            <FaInfoCircle />
                          </Tooltip>
                        </TableHeaderCell>
                        <TableHeaderCell>Zutat</TableHeaderCell>
                        <TableHeaderCell>Gesamt Menge</TableHeaderCell>
                        <TableHeaderCell className="print:hidden">Ausgabe Einheit</TableHeaderCell>
                        <TableHeaderCell>Anzahl</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ingredientCalculationItems.length == 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            Keine Zutaten benötigt
                          </TableCell>
                        </TableRow>
                      ) : (
                        _.chain(ingredientCalculationItems)
                          .groupBy('ingredient.id')
                          .sortBy((group) => group[0].ingredient.name)
                          .map((items, key) => (
                            <TableRow key={`shopping-ingredient-${key}`}>
                              <TableCell className="w-0">
                                <Checkbox
                                  key={`shopping-ingredient-${key}-checkbox-${items[0].ingredient.id}`}
                                  checkboxSize="sm"
                                  className="w-min justify-self-center"
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
                              </TableCell>
                              <TableCell>{items[0].ingredient.name}</TableCell>
                              <TableCell className="flex flex-col">
                                {items.map((item) => (
                                  <div key={`shopping-ingredient-${key}-unit-${item.unit.id}`}>
                                    {item.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {userContext.getTranslation(item.unit.name ?? 'N/A', 'de')}
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="print:hidden">
                                <Select
                                  selectSize="sm"
                                  value={
                                    ingredientShoppingUnits.find((ingredientShoppingUnit) => ingredientShoppingUnit.ingredientId == items[0].ingredient.id)
                                      ?.unitId ??
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
                                  <option value="" disabled>
                                    Auswählen
                                  </option>
                                  {ingredients
                                    .find((ingredient) => ingredient.id == items[0].ingredient.id)
                                    ?.IngredientVolume.map((unit) => (
                                      <option key={`ingredientCalculation-${items[0].ingredient.id}-output-unit-${unit.unitId}`} value={unit.unitId}>
                                        {userContext.getTranslation(unit.unit.name ?? 'N/A', 'de')}
                                      </option>
                                    ))}
                                </Select>
                              </TableCell>
                              <TableCell>
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
                              </TableCell>
                            </TableRow>
                          ))
                          .value()
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className={'text-lg font-bold'}>Garnituren</div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Garnitur</TableHeaderCell>
                        <TableHeaderCell>Menge</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {garnishCalculationItems.length == 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center">
                            Keine Garnituren benötigt
                          </TableCell>
                        </TableRow>
                      ) : (
                        garnishCalculationItems
                          .sort((a, b) => a.garnish.name.localeCompare(b.garnish.name))
                          .map((garnishCalculationItem) => (
                            <TableRow key={'garnishCalculation-' + garnishCalculationItem.garnish.id}>
                              <TableCell>{garnishCalculationItem.garnish.name}</TableCell>
                              <TableCell>
                                {garnishCalculationItem.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ManageEntityLayout>
  );
}
