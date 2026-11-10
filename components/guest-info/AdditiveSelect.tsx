import React from 'react';
import { useTranslation } from 'react-i18next';
import { ADDITIVE_NUMBERS, ADDITIVES, type Additive } from '@lib/guest-info/constants';
import { CodeChipSelect } from './CodeChipSelect';

export interface AdditiveSelectProps {
  value: readonly Additive[];
  onChange: (value: Additive[]) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

/** Chip multi-select for labelling-relevant additives (with footnote number). */
export function AdditiveSelect(props: AdditiveSelectProps) {
  const { t } = useTranslation(['guestInfo']);
  return (
    <CodeChipSelect
      {...props}
      aria-label={t('guestInfo:additivesTitle')}
      options={ADDITIVES}
      getLabel={(code) => t(`guestInfo:additive.${code}`)}
      getPrefix={(code) => String(ADDITIVE_NUMBERS[code])}
    />
  );
}
