import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { Button } from '@components/ui';

interface SearchResultRowProps {
  cocktail: CocktailSummaryDto;
  isArchived?: boolean;
  onSelect: (cocktail: CocktailSummaryDto) => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  showAction?: boolean;
}

export function SearchResultRow({ cocktail, isArchived = false, onSelect, actionLabel, actionDisabled = false, showAction = true }: SearchResultRowProps) {
  const { t } = useTranslation('common');
  const resolvedActionLabel = actionLabel ?? t('view');

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300/60 px-4 py-3 transition-colors hover:bg-base-200/60"
      onClick={() => onSelect(cocktail)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(cocktail);
        }
      }}
    >
      <span className="min-w-0 truncate text-base font-medium md:text-lg">
        {cocktail.name}
        {isArchived ? ` ${t('archivedParen')}` : ''}
      </span>
      {showAction ? (
        <Button
          type="button"
          disabled={actionDisabled}
          variant="primary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(cocktail);
          }}
        >
          {resolvedActionLabel}
        </Button>
      ) : null}
    </div>
  );
}
