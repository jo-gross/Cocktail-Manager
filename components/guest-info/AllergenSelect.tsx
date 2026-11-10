import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALLERGEN_CODES, ALLERGENS, type Allergen } from '@lib/guest-info/constants';
import { CodeChipSelect } from './CodeChipSelect';

export interface AllergenSelectProps {
  value: readonly Allergen[];
  onChange: (value: Allergen[]) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

/** Chip multi-select for the 14 EU allergens (short label, full name as tooltip). */
export function AllergenSelect(props: AllergenSelectProps) {
  const { t } = useTranslation(['guestInfo']);
  return (
    <CodeChipSelect
      {...props}
      aria-label={t('guestInfo:allergensTitle')}
      options={ALLERGENS}
      getLabel={(code) => t(`guestInfo:allergenShort.${code}`)}
      getTitle={(code) => t(`guestInfo:allergen.${code}`)}
      getPrefix={(code) => ALLERGEN_CODES[code]}
    />
  );
}
