import React from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import '../../lib/NumberUtils';

interface CompactCocktailCardProps {
  cocktail: CocktailRecipeFull;
  onAdd: () => void;
  onAddWithDeposit: () => void;
}

export function CompactCocktailCard({ cocktail, onAdd, onAddWithDeposit }: CompactCocktailCardProps) {
  const price = cocktail.price ?? 0;
  const deposit = cocktail.glass?.deposit ?? 0;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body p-4">
        <h3 className="card-title text-lg">{cocktail.name}</h3>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>Preis:</span>
            <span className="font-bold">{price.formatPrice()} €</span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between">
              <span>Glaspfand:</span>
              <span className="font-bold">{deposit.formatPrice()} €</span>
            </div>
          )}
        </div>
        <div className="card-actions mt-2 flex gap-2">
          <button className="btn btn-primary btn-sm flex-1" onClick={onAdd}>
            + Hinzufügen
          </button>
          {deposit > 0 && (
            <button className="btn btn-outline btn-primary btn-sm flex-1" onClick={onAddWithDeposit}>
              Glas zurück
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

