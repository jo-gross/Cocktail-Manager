import { CocktailRecipeFull } from 'models/CocktailRecipeFull';
import React from 'react';
import { Badge } from '@components/ui';
import { toIntlLocale } from '@lib/i18n/format';
import type { AppLocale } from '@lib/i18n/locales';

export interface CocktailPdfLabels {
  price: (price: string) => string;
  glass: (name: string) => string;
  ice: (name: string) => string;
  preparation: string;
  optional: string;
  garnish: string;
  prepNotes: string;
  description: string;
  history: string;
}

interface CocktailPdfPageProps {
  cocktail: CocktailRecipeFull;
  imageBase64?: string | null;
  getTranslation?: (key: string) => string;
  labels: CocktailPdfLabels;
  locale?: AppLocale;
  exportImage?: boolean;
  exportDescription?: boolean;
  exportNotes?: boolean;
  exportHistory?: boolean;
}

export function CocktailPdfPage({
  cocktail,
  imageBase64,
  getTranslation = (key: string) => key,
  labels,
  locale = 'de',
  exportImage = true,
  exportDescription = true,
  exportNotes = true,
  exportHistory = true,
}: CocktailPdfPageProps) {
  const shouldShowImage = exportImage && imageBase64;
  const intlLocale = toIntlLocale(locale);
  const formattedPrice =
    cocktail.price != undefined ? cocktail.price.toLocaleString(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : undefined;

  return (
    <div className="h-fit bg-white">
      <div className="p-4">
        <div className="mb-2 border-b-2 border-primary pb-2">
          <h1 className="text-3xl font-bold text-primary">{cocktail.name}</h1>
          {formattedPrice != undefined && <div className="mt-1 text-xl">{labels.price(formattedPrice)}</div>}
        </div>

        <div className={`grid ${shouldShowImage ? 'grid-cols-3' : 'grid-cols-1'} mb-2 gap-2`}>
          <div className={`${imageBase64 ? 'col-span-2' : 'col-span-1'} flex flex-col gap-1`}>
            <div className="mb-2 flex flex-row justify-between gap-2 rounded border p-2">
              <div className="flex flex-1 flex-col gap-1">
                {cocktail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cocktail.tags.map((tag) => (
                      <Badge key={`pdf-tag-${tag}`} variant="primary" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-1 items-end justify-between gap-2 text-sm">
                  {cocktail.glass && <div>{labels.glass(cocktail.glass.name)}</div>}
                  {cocktail.ice && <div>{labels.ice(getTranslation(cocktail.ice.name))}</div>}
                </div>
              </div>
            </div>
            <div className="text-lg font-bold">{labels.preparation}</div>
            <div className="space-y-1">
              {cocktail.steps
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step) => (
                  <div key={`pdf-step-${step.id}`} className="rounded bg-base-100 p-2">
                    <div className={`text-md font-bold ${step.optional ? 'italic' : ''}`}>
                      {getTranslation(step.action.name)} {step.optional && labels.optional}
                    </div>
                    {step.ingredients
                      .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                      .map((stepIngredient) => (
                        <div
                          key={`pdf-step-ingredient-${stepIngredient.id}`}
                          className={`ml-3 flex flex-row gap-1 text-sm ${stepIngredient.optional ? 'italic' : ''}`}
                        >
                          <span className="font-bold">
                            {stepIngredient.amount?.toLocaleString(intlLocale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            }) ?? ''}
                          </span>
                          <span className="font-bold">{stepIngredient.unit?.name ? getTranslation(stepIngredient.unit.name) : ''}</span>
                          <span>{stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name ?? ''}</span>
                          {stepIngredient.optional && <span className="text-xs">{labels.optional}</span>}
                        </div>
                      ))}
                  </div>
                ))}
            </div>

            {cocktail.garnishes.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-lg font-bold">{labels.garnish}</div>
                <div className="space-y-1">
                  {cocktail.garnishes
                    .sort((a, b) => a.garnishNumber - b.garnishNumber)
                    .map((garnish) => (
                      <div key={`pdf-garnish-${garnish.garnishId}`} className={`rounded bg-base-100 p-2 ${garnish.optional ? 'italic' : ''}`}>
                        <div className={'text-md'}>
                          <span className={'font-bold'}>{garnish.garnish.name}</span> {garnish.optional && labels.optional}
                        </div>
                        {garnish.description && (
                          <div>
                            <div className="text-xs">{garnish.description}</div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          {shouldShowImage && (
            <div className="col-span-1 flex justify-center">
              <img src={imageBase64} alt={cocktail.name} className="h-full w-fit rounded-lg object-contain" />
            </div>
          )}
        </div>

        {exportNotes && cocktail.notes && (
          <div className="mb-1">
            <div className="mb-1 text-lg font-bold">{labels.prepNotes}</div>
            <div className="long-text-format text-xs whitespace-pre-line">{cocktail.notes}</div>
          </div>
        )}

        {exportDescription && cocktail.description && (
          <div className="mb-1">
            <h2 className="mb-1 text-lg font-bold">{labels.description}</h2>
            <div className="long-text-format text-justify text-xs whitespace-pre-line">{cocktail.description}</div>
          </div>
        )}

        {exportHistory && cocktail.history && (
          <div className="mb-1">
            <h2 className="mb-1 text-lg font-bold">{labels.history}</h2>
            <div className="long-text-format text-justify text-xs whitespace-pre-line">{cocktail.history}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function buildCocktailPdfLabels(t: (key: string, options?: Record<string, unknown>) => string): CocktailPdfLabels {
  return {
    price: (price) => t('cocktail:priceLabel', { price }),
    glass: (name) => t('cocktail:glassLabel', { name }),
    ice: (name) => t('cocktail:iceLabel', { name }),
    preparation: t('cocktail:preparation'),
    optional: t('cocktail:optional'),
    garnish: t('cocktail:garnish'),
    prepNotes: t('cocktail:prepNotes'),
    description: t('cocktail:description'),
    history: t('cocktail:history'),
  };
}
