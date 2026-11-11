import React from 'react';
import { useTranslation } from 'react-i18next';
import { allergenSourcesOf, pruneAllergenSources, SPECIFIABLE_ALLERGENS, type Allergen, type AllergenSource } from '@lib/guest-info/constants';
import { FormField } from '@components/forms/FormField';
import { CodeChipSelect } from './CodeChipSelect';

interface AllergenSourceFieldsProps {
  allergens: readonly Allergen[];
  value: readonly AllergenSource[];
  onChange: (value: AllergenSource[]) => void;
  disabled?: boolean;
}

/**
 * For each selected allergen Annex II names in detail (GLUTEN → Weizen, Roggen, …; NUTS → Mandeln, …):
 * an optional chip selection, indented below the allergen chips.
 */
export function AllergenSourceFields({ allergens, value, onChange, disabled }: AllergenSourceFieldsProps) {
  const { t } = useTranslation(['guestInfo']);
  const selected = SPECIFIABLE_ALLERGENS.filter((allergen) => allergens.includes(allergen));
  if (selected.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 border-l-2 border-base-300 pl-3">
      {selected.map((allergen, index) => {
        const options = allergenSourcesOf(allergen);
        return (
          <FormField
            key={allergen}
            label={t(`guestInfo:form.allergenSources.${allergen as 'GLUTEN' | 'NUTS'}`)}
            hint={index === selected.length - 1 ? t('guestInfo:form.allergenSources.hint') : undefined}
          >
            <CodeChipSelect
              aria-label={t(`guestInfo:form.allergenSources.${allergen as 'GLUTEN' | 'NUTS'}`)}
              options={options}
              disabled={disabled}
              value={value.filter((source) => options.includes(source))}
              getLabel={(source) => t(`guestInfo:allergenSource.${source}`)}
              // Keep the sources of the other allergens untouched.
              onChange={(next) => onChange(pruneAllergenSources(allergens, [...value.filter((source) => !options.includes(source)), ...next]))}
            />
          </FormField>
        );
      })}
    </div>
  );
}
