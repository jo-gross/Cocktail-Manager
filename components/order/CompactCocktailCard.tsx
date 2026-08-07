import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import '../../lib/NumberUtils';
import { Button, Card, CardActions, CardBody, CardTitle } from '@components/ui';

interface CompactCocktailCardProps {
  cocktail: CocktailSummaryDto;
  onAdd: () => void;
  onAddWithDeposit: () => void;
}

export function CompactCocktailCard({ cocktail, onAdd, onAddWithDeposit }: CompactCocktailCardProps) {
  const { t } = useTranslation('order');
  const price = cocktail.price ?? 0;
  const deposit = cocktail.glass?.deposit ?? 0;

  return (
    <Card variant="elevated">
      <CardBody>
        <CardTitle className="text-lg">{cocktail.name}</CardTitle>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>{t('priceLabel')}</span>
            <span className="font-bold">{price.formatPrice()} €</span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between">
              <span>{t('glassDeposit')}</span>
              <span className="font-bold">{deposit.formatPrice()} €</span>
            </div>
          )}
        </div>
        <CardActions className="mt-2 flex gap-2">
          <Button type="button" variant="primary" size="sm" className="flex-1" onClick={onAdd}>
            {t('add')}
          </Button>
          {deposit > 0 && (
            <Button type="button" variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary/10" onClick={onAddWithDeposit}>
              {t('returnGlass')}
            </Button>
          )}
        </CardActions>
      </CardBody>
    </Card>
  );
}
