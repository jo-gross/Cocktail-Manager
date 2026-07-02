import React from 'react';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import '../../lib/NumberUtils';
import { Button, Card, CardActions, CardBody, CardTitle } from '@components/ui';

interface CompactCocktailCardProps {
  cocktail: CocktailRecipeFull;
  onAdd: () => void;
  onAddWithDeposit: () => void;
}

export function CompactCocktailCard({ cocktail, onAdd, onAddWithDeposit }: CompactCocktailCardProps) {
  const price = cocktail.price ?? 0;
  const deposit = cocktail.glass?.deposit ?? 0;

  return (
    <Card variant="elevated">
      <CardBody>
        <CardTitle className="text-lg">{cocktail.name}</CardTitle>
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
        <CardActions className="mt-2 flex gap-2">
          <Button type="button" variant="primary" size="sm" className="flex-1" onClick={onAdd}>
            + Hinzufügen
          </Button>
          {deposit > 0 && (
            <Button type="button" variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary/10" onClick={onAddWithDeposit}>
              Glas zurück
            </Button>
          )}
        </CardActions>
      </CardBody>
    </Card>
  );
}
