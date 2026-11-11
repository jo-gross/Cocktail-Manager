import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { CocktailRecipeStepFull } from '../../models/CocktailRecipeStepFull';
import type { CocktailRecipeGarnishFull } from '../../models/CocktailRecipeGarnishFull';
import type { IngredientModel } from '../../models/IngredientModel';
import { UserContext } from '@lib/context/UserContextProvider';
import { cn } from '@components/ui';
import '../../lib/NumberUtils';

interface CocktailCostSummaryProps {
  steps: CocktailRecipeStepFull[];
  garnishes: (CocktailRecipeGarnishFull & { isAlternative?: boolean })[];
  /** Loaded ingredient list (provides the volumes per unit). */
  ingredients: IngredientModel[];
  total: number;
}

/** Cost breakdown of a cocktail recipe (ingredients, garnishes, sum) for the recipe form. */
export function CocktailCostSummary({ steps, garnishes, ingredients, total }: CocktailCostSummaryProps) {
  const { t } = useTranslation(['cocktail', 'common']);
  const userContext = useContext(UserContext);

  const lines = steps.flatMap((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined));

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-base-content/60 uppercase">{t('cocktail:ingredients')}</h3>
        {lines.length > 0 ? (
          <dl className="flex flex-col divide-y divide-base-300">
            {lines.map((stepIngredient, index) => {
              const volume = ingredients
                .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                ?.volumes.find((volumeUnits) => volumeUnits.unit.id == stepIngredient.unitId)?.volume;
              const unitPrice = volume != undefined ? (stepIngredient.ingredient?.price ?? 0) / volume : undefined;
              return (
                <div key={`cost-line-${index}`} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="min-w-0">
                    <span className="block truncate">{stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name}</span>
                    {unitPrice != undefined ? (
                      <span className="block text-xs text-base-content/60">
                        {t('common:unitTimesPrice', {
                          amount: stepIngredient.amount?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) ?? 0,
                          unit: userContext.getTranslation(stepIngredient?.unit?.name ?? ''),
                          price: unitPrice.formatPrice(),
                        })}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="shrink-0 tabular-nums">{unitPrice != undefined ? `${(unitPrice * (stepIngredient.amount ?? 0)).formatPrice()} €` : '-'}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-base-content/60 italic">{t('cocktail:noIngredients')}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-base-content/60 uppercase">{t('cocktail:garnish')}</h3>
        {garnishes.length > 0 ? (
          <dl className="flex flex-col divide-y divide-base-300">
            {garnishes.map((garnish, index) => (
              <div
                key={`cost-garnish-${index}`}
                className={cn('flex items-baseline justify-between gap-3 py-1.5', garnish.isAlternative && 'line-through opacity-50')}
              >
                <dt className="min-w-0">
                  <span className="block truncate">{garnish?.garnish?.name}</span>
                  <span className="block text-xs text-base-content/60">{t('common:timesPrice', { price: (garnish?.garnish?.price ?? 0).formatPrice() })}</span>
                </dt>
                <dd className="shrink-0 tabular-nums">{(garnish?.garnish?.price ?? 0).formatPrice()} €</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-base-content/60 italic">{t('cocktail:noGarnishes')}</p>
        )}
        {garnishes.some((garnish) => garnish.isAlternative) && <p className="text-xs text-base-content/60">{t('cocktail:altGarnishNote')}</p>}
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-base-300 pt-2 text-base font-semibold">
        <span>{t('common:sum')}</span>
        <span className="tabular-nums">{total.formatPrice()} €</span>
      </div>
    </div>
  );
}
