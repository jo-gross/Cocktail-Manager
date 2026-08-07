import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import type { CocktailDto, CocktailGarnishRef, CocktailIngredientRef, CocktailUnitRef } from '@lib/schemas/cocktails';
import type { CalculationDto } from '@lib/schemas/calculations';
import { FaInfoCircle, FaPencilAlt, FaPrint, FaSave, FaTrashAlt } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { SearchModal } from '@components/modals/SearchModal';
import { alertService } from '@lib/alertService';
import { calcCocktailTotalPrice } from '@lib/CocktailRecipeCalculation';
import type { UnitDto } from '@lib/schemas/units';
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
import { createCalculation, getCalculation, updateCalculation } from '@lib/network/calculations';
import { alertApiV1Error, apiV1Fetch } from '@lib/network/apiV1';
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

/** Local calculation item with a fully hydrated CocktailDto (fetched separately from the slim CalculationDto refs). */
interface CocktailCalculationItem {
  cocktail: CocktailDto;
  plannedAmount: number;
  customPrice: number | undefined;
}

interface IngredientCalculationItem {
  ingredient: CocktailIngredientRef;
  amount: number;
  unit: CocktailUnitRef;
}

interface GarnishCalculationItem {
  garnish: CocktailGarnishRef;
  amount: number;
}

/** Flat write shape for shopping units (matches CalculationShoppingUnitInputSchema). */
interface IngredientShoppingUnit {
  ingredientId: string;
  unitId: string;
  checked: boolean;
}

export default function CalculationPage() {
  const { t } = useTranslation(['manage', 'common', 'cocktail', 'nav', 'errors', 'entity']);
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

  const [units, setUnits] = useState<UnitDto[]>([]);
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

  // Fetch Calculation (slim item refs) then hydrate each cocktail via CocktailDto
  useEffect(() => {
    if (!id) return;
    if (id == 'create') return;
    if (!workspaceId) return;
    setLoading(true);
    getCalculation(workspaceId, id as string)
      .then(async (data: CalculationDto) => {
        setCalculationName(data.name);
        setShowSalesStuff(data.showSalesStuff ?? false);
        setOriginalName(data.name);
        setOriginalShowSalesStuff(data.showSalesStuff ?? false);

        const shoppingUnits: IngredientShoppingUnit[] = (data.ingredientShoppingUnits ?? []).map((unit) => ({
          ingredientId: unit.ingredient.id,
          unitId: unit.unit.id,
          checked: unit.checked,
        }));
        setIngredientShoppingUnits(shoppingUnits);
        setOriginalIngredientShoppingUnits(JSON.stringify(shoppingUnits));

        const hydratedItems = await Promise.all(
          data.items.map(async (item) => {
            const cocktail = await apiV1Fetch<CocktailDto>(`/api/v1/workspaces/${workspaceId}/cocktails/${item.cocktail.id}`);
            return {
              cocktail,
              plannedAmount: item.plannedAmount,
              customPrice: item.customPrice ?? undefined,
            } satisfies CocktailCalculationItem;
          }),
        );
        setCocktailCalculationItems(hydratedItems);
        setOriginalItems(JSON.stringify(hydratedItems));
      })
      .catch((error) => {
        console.error('CocktailCalculation -> useEffect[init, id != create]', error);
        alertApiV1Error(error, t('errors:loadCalculation'));
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
        apiV1Fetch<CocktailDto>(`/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}`)
          .then((cocktail) => {
            setCocktailCalculationItems([...cocktailCalculationItems, { cocktail, plannedAmount: 1, customPrice: undefined }]);
          })
          .catch((error) => {
            console.error('CalculationId -> addCocktailToSelection (not already exists) -> fetchCocktail', error);
            alertApiV1Error(error, t('cocktail:error.loadOne'));
          })
          .finally(() => {
            triggerRecalculate(true);
          });
      }
    },
    [cocktailCalculationItems, workspaceId],
  );

  // Ingredient Calculation — CocktailDto step lines expose nested ingredient/unit refs (no flat FKs)
  useEffect(() => {
    let calculationItems: IngredientCalculationItem[] = [];

    cocktailCalculationItems.forEach((item) => {
      item.cocktail.steps.forEach((step) => {
        step.ingredients.forEach((stepIngredient) => {
          if (stepIngredient.ingredient != null && stepIngredient.unit != null) {
            const ingredientId = stepIngredient.ingredient.id;
            const unitId = stepIngredient.unit.id;
            const existingItem = calculationItems.find((calculationItem) => calculationItem.ingredient.id == ingredientId && calculationItem.unit.id == unitId);
            if (existingItem) {
              existingItem.amount += (stepIngredient.amount ?? 0) * item.plannedAmount;
              calculationItems = [...calculationItems.filter((calcItem) => calcItem.ingredient.id != existingItem.ingredient.id), existingItem];
            } else {
              calculationItems.push({
                ingredient: stepIngredient.ingredient,
                amount: (stepIngredient.amount ?? 0) * item.plannedAmount,
                unit: stepIngredient.unit,
              });
            }
          }
        });
      });
    });
    setIngredientCalculationItems(calculationItems);
  }, [cocktailCalculationItems]);

  // Garnish Calculation
  useEffect(() => {
    let calculationItems: GarnishCalculationItem[] = [];

    cocktailCalculationItems.forEach((item) => {
      item.cocktail.garnishes
        .filter((g) => !g.isAlternative)
        .forEach((garnish) => {
          const existingItem = calculationItems.find((calculationItem) => calculationItem.garnish.id == garnish.garnishId);
          if (existingItem) {
            existingItem.amount += item.plannedAmount;
            calculationItems = [...calculationItems.filter((calcItem) => calcItem.garnish.id != existingItem.garnish.id), existingItem];
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

      const savePromise =
        id == 'create'
          ? createCalculation(workspaceId!, body).then(async (created) => {
              setOriginalItems(JSON.stringify(cocktailCalculationItems));
              setOriginalShowSalesStuff(showSalesStuff);
              setOriginalName(calculationName);
              setOriginalIngredientShoppingUnits(JSON.stringify(ingredientShoppingUnits));
              if (redirect) {
                await router.replace(`/workspaces/${workspaceId}/manage/calculations/${created.id}`);
              }
              alertService.success(t('common:success.created'));
            })
          : updateCalculation(workspaceId!, id as string, body).then(async (updated) => {
              setOriginalItems(JSON.stringify(cocktailCalculationItems));
              setOriginalShowSalesStuff(showSalesStuff);
              setOriginalName(calculationName);
              setOriginalIngredientShoppingUnits(JSON.stringify(ingredientShoppingUnits));
              if (redirect) {
                await router.replace(`/workspaces/${workspaceId}/manage/calculations/${updated.id}`);
              }
              alertService.success(t('manage:calculations.calculationSaved'));
            });

      savePromise
        .catch((error) => {
          console.error('CalculationId -> saveCalculation', error);
          alertApiV1Error(error, id == 'create' ? t('errors:createCalculation') : t('errors:updateCalculation'));
        })
        .finally(() => {
          setSaving(false);
          window.scrollTo(0, currentScrollTop);
        });
    },
    [ingredientShoppingUnits, id, calculationName, showSalesStuff, cocktailCalculationItems, workspaceId, router, t],
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
      <InputModal title={t('manage:calculations.saveTitle')} onInputSubmit={async (value) => setCalculationName(value)} defaultValue={calculationName} />,
    );
  }, [calculationName, modalContext, t]);

  // All must have the same ingredient
  const calculateTotalIngredientAmount = useCallback(
    (items: IngredientCalculationItem[]) => {
      return (
        items.reduce(
          (acc, curr) =>
            acc +
            curr.amount /
              (ingredients.find((ingredient) => ingredient.id == curr.ingredient.id)?.volumes?.find((volume) => volume.unit.id == curr.unit.id)?.volume ?? 0),
          0,
        ) *
        (ingredients
          .find((ingredient) => ingredient.id == items[0].ingredient.id)
          ?.volumes?.find((volume) => volume.unit.id == ingredientShoppingUnits.find((ingredient) => ingredient.ingredientId == items[0].ingredient.id)?.unitId)
          ?.volume ?? 0)
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
                (ingredients.find((ingredient) => ingredient.id == curr.ingredient.id)?.volumes?.find((volume) => volume.unit.id == curr.unit.id)?.volume ?? 0),
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
      const summedIngredientPerCocktails: { ingredient: CocktailIngredientRef; amountInPercent: number }[] = [];
      calculationItem.cocktail.steps
        .flatMap((step) => step.ingredients)
        .filter((stepIngredient) => stepIngredient.ingredient != null && stepIngredient.unit != null)
        .forEach((stepIngredient) => {
          const ingredientId = stepIngredient.ingredient!.id;
          const unitId = stepIngredient.unit!.id;
          const existingItem = summedIngredientPerCocktails.find((item) => item.ingredient.id == ingredientId);
          if (existingItem) {
            existingItem.amountInPercent +=
              (stepIngredient.amount ?? 0) /
              (ingredients.find((ingredient) => ingredient.id == ingredientId)?.volumes.find((volume) => volume.unit.id == unitId)?.volume ?? 1);
          } else {
            summedIngredientPerCocktails.push({
              ingredient: stepIngredient.ingredient!,
              amountInPercent:
                (stepIngredient.amount ?? 0) /
                (ingredients.find((ingredient) => ingredient.id == ingredientId)?.volumes.find((volume) => volume.unit.id == unitId)?.volume ?? 1),
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
      `${t('entity:auditHeader.checked')},${t('common:name')},${t('manage:calculations.plannedAmount')},${t('entity:auditHeader.unit')}\n` +
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
  }, [calculateTotalIngredientAmount, ingredientCalculationItems, ingredientShoppingUnits, t, units, userContext]);

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
          t('manage:calculations.title')
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
            <span>{t('manage:calculations.title')}</span>
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
          {t('common:save')}
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
                <div className={'text-center text-2xl font-bold print:text-xl'}>{t('manage:calculations.drinksOverview')}</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                </div>
                <div className="overflow-x-auto">
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-20">{t('manage:calculations.plannedAmount')}</TableHeaderCell>
                        <TableHeaderCell className="w-full">{t('common:name')}</TableHeaderCell>
                        <TableHeaderCell className="print:hidden">{t('manage:calculations.amountSuggestions')}</TableHeaderCell>
                        {showSalesStuff ? (
                          <>
                            <TableHeaderCell className="min-w-20">{t('common:price')}</TableHeaderCell>
                            <TableHeaderCell>{t('common:customPrice')}</TableHeaderCell>
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
                            {t('common:add')}
                          </Button>
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cocktailCalculationItems.length == 0 ? (
                        <TableRow className="text-center">
                          <TableCell colSpan={showSalesStuff ? 6 : 4}>{t('common:emptyEntriesPresent')}</TableCell>
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
                                      <div className="text-lg font-semibold">{t('manage:calculations.amountSuggestions')}</div>
                                      <div>{t('manage:calculations.amountSuggestionsHelp')}</div>
                                      <Divider className="font-bold">{t('cocktail:ingredients')}</Divider>
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
                                                {t('manage:calculations.adjustPositive', { count: Math.floor(item.more) })}
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
                                                {t('manage:calculations.adjustNegative', { count: Math.floor(item.less) })}
                                              </Button>
                                            </React.Fragment>
                                          ))}
                                      </div>
                                    </div>,
                                  );
                                }}
                              >
                                <FaInfoCircle />
                                <span>{t('manage:show')}</span>
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
                                        entityName={t('entity:theCocktail', { name: cocktail.cocktail.name })}
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
                <div className={'text-center text-2xl font-bold print:text-xl'}>{t('cocktail:finances')}</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                  <FormControl>
                    <Label className="flex-row items-center justify-between">
                      <LabelText>{t('manage:calculations.businessView')}</LabelText>
                      <Toggle checked={showSalesStuff} onChange={(event) => setShowSalesStuff(event.target.checked)} />
                    </Label>
                  </FormControl>
                </div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{t('common:ingredientLabel')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:amount')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:calculations.productionPrice')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:calculations.productionSum')}</TableHeaderCell>
                        {showSalesStuff ? (
                          <>
                            <TableHeaderCell>{t('manage:calculations.expectedRevenue')}</TableHeaderCell>
                            <TableHeaderCell>{t('manage:calculations.expectedProfit')}</TableHeaderCell>
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
                              <TableCell>
                                {cocktail.plannedAmount} {t('manage:times')}
                              </TableCell>
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
                        <TableCell className="font-bold">{t('manage:total')}</TableCell>
                        <TableCell>
                          {cocktailCalculationItems
                            .map((cocktail) => cocktail.plannedAmount)
                            .reduce((acc, curr) => acc + curr, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                          {t('manage:times')}
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
                <div className={'text-center text-2xl font-bold print:text-xl'}>{t('manage:calculations.shoppingList')}</div>
                <div className={'print:hidden'}>
                  <Divider size="sm" />
                </div>
                <div className={'flex items-center justify-between'}>
                  <div className={'text-lg font-bold'}>{t('cocktail:ingredients')}</div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCSVExport}>
                    <FaSave />
                    {t('manage:calculations.exportCsv')}
                  </Button>
                </div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell className="w-0">
                          <Tooltip tip={t('manage:calculations.shoppingListCheckboxTip')}>
                            <FaInfoCircle />
                          </Tooltip>
                        </TableHeaderCell>
                        <TableHeaderCell>{t('common:ingredientLabel')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:calculations.totalAmount')}</TableHeaderCell>
                        <TableHeaderCell className="print:hidden">{t('manage:calculations.outputUnit')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:quantity')}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ingredientCalculationItems.length == 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            {t('manage:calculations.noIngredientsNeeded')}
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
                                    {userContext.getTranslation(item.unit.name ?? 'N/A')}
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="print:hidden">
                                <Select
                                  selectSize="sm"
                                  value={
                                    ingredientShoppingUnits.find((ingredientShoppingUnit) => ingredientShoppingUnit.ingredientId == items[0].ingredient.id)
                                      ?.unitId ??
                                    (ingredients.find((ingredient) => ingredient.id == items[0].ingredient.id)?.volumes.length == 1
                                      ? ingredients.find((ingredient) => ingredient.id == items[0].ingredient.id)?.volumes[0].unit.id
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
                                    {t('common:select')}
                                  </option>
                                  {ingredients
                                    .find((ingredient) => ingredient.id == items[0].ingredient.id)
                                    ?.volumes.map((unit) => (
                                      <option key={`ingredientCalculation-${items[0].ingredient.id}-output-unit-${unit.unit.id}`} value={unit.unit.id}>
                                        {userContext.getTranslation(unit.unit.name ?? 'N/A')}
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
                <div className={'text-lg font-bold'}>{t('nav:garnishes')}</div>
                <div className={'overflow-x-auto'}>
                  <Table compact className="w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{t('cocktail:garnish')}</TableHeaderCell>
                        <TableHeaderCell>{t('manage:amount')}</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {garnishCalculationItems.length == 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center">
                            {t('manage:calculations.noGarnishesNeeded')}
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
