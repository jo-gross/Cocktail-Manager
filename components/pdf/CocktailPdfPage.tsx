import { CocktailRecipeFull } from 'models/CocktailRecipeFull';
import React from 'react';

interface CocktailPdfPageProps {
  cocktail: CocktailRecipeFull;
  imageBase64?: string | null;
  getTranslation?: (key: string) => string;
}

export function CocktailPdfPage({ cocktail, imageBase64, getTranslation = (key: string) => key }: CocktailPdfPageProps) {
  return (
    <div className="h-fit bg-white">
      <div className="p-4">
        {/* Header */}
        <div className="mb-2 border-b-2 border-primary pb-2">
          <h1 className="text-3xl font-bold text-primary">{cocktail.name}</h1>
          {cocktail.price != undefined && <div className="mt-1 text-xl">Preis: {cocktail.price.toFixed(2).replace('.', ',')} €</div>}
        </div>

        {/* Bild und Zubereitung in Grid */}
        <div className={`grid ${imageBase64 ? 'grid-cols-3' : 'grid-cols-1'} mb-2 gap-2`}>
          <div className={`${imageBase64 ? 'col-span-2' : 'col-span-1'} flex flex-col gap-1`}>
            {/* Tags und Glas/Eis */}
            <div className="mb-2 flex flex-row justify-between gap-2 rounded border p-2">
              <div className="flex flex-1 flex-col gap-1">
                {cocktail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cocktail.tags.map((tag) => (
                      <div key={`pdf-tag-${tag}`} className="badge badge-primary badge-sm">
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-1 items-end justify-between gap-2 text-sm">
                  {cocktail.glass && <div>Glas: {cocktail.glass.name}</div>}
                  {cocktail.ice && <div>Eis: {getTranslation(cocktail.ice.name)}</div>}
                </div>
              </div>
            </div>
            <div className="text-lg font-bold">Zubereitung</div>
            <div className="space-y-1">
              {cocktail.steps
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step) => (
                  <div key={`pdf-step-${step.id}`} className="rounded bg-base-100 p-2">
                    <div className={`text-md font-bold ${step.optional ? 'italic' : ''}`}>
                      {getTranslation(step.action.name)} {step.optional && '(optional)'}
                    </div>
                    {step.ingredients
                      .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                      .map((stepIngredient) => (
                        <div
                          key={`pdf-step-ingredient-${stepIngredient.id}`}
                          className={`ml-3 flex flex-row gap-1 text-sm ${stepIngredient.optional ? 'italic' : ''}`}
                        >
                          <span className="font-bold">
                            {stepIngredient.amount?.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            }) ?? ''}
                          </span>
                          <span className="font-bold">{stepIngredient.unit?.name ? getTranslation(stepIngredient.unit.name) : ''}</span>
                          <span>{stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name ?? ''}</span>
                          {stepIngredient.optional && <span className="text-xs">(optional)</span>}
                        </div>
                      ))}
                  </div>
                ))}
            </div>

            {/* Garnituren */}
            {cocktail.garnishes.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-lg font-bold">Garnitur</div>
                <div className="space-y-1">
                  {cocktail.garnishes
                    .sort((a, b) => a.garnishNumber - b.garnishNumber)
                    .map((garnish) => (
                      <div key={`pdf-garnish-${garnish.garnishId}`} className={`rounded bg-base-100 p-2 ${garnish.optional ? 'italic' : ''}`}>
                        <div className={'text-md'}>
                          <span className={'font-bold'}>{garnish.garnish.name}</span> {garnish.optional && '(optional)'}
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
          {imageBase64 && (
            <div className="col-span-1 flex justify-center">
              <img src={imageBase64} alt={cocktail.name} className="h-full w-fit rounded-lg object-contain" />
            </div>
          )}
        </div>

        {/* Notizen, Beschreibung, Geschichte - Reihenfolge wie im DetailModal */}
        {cocktail.notes && (
          <div className="mb-1">
            <div className="mb-1 text-lg font-bold">Zubereitungsnotizen</div>
            <div className="long-text-format whitespace-pre-line text-xs">{cocktail.notes}</div>
          </div>
        )}

        {cocktail.description && (
          <div className="mb-1">
            <h2 className="mb-1 text-lg font-bold">Allgemeine Beschreibung</h2>
            <div className="long-text-format whitespace-pre-line text-justify text-xs">{cocktail.description}</div>
          </div>
        )}

        {cocktail.history && (
          <div className="mb-1">
            <h2 className="mb-1 text-lg font-bold">Geschichte und Entstehung</h2>
            <div className="long-text-format whitespace-pre-line text-justify text-xs">{cocktail.history}</div>
          </div>
        )}
      </div>
    </div>
  );
}
