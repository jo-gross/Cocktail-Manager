import React from 'react';
import ReactSelect from 'react-select';
import { useTranslation } from 'react-i18next';
import { Button, cn } from '@components/ui';

interface AdditionalContentLanguagesProps {
  inputId: string;
  options: string[];
  primary: string;
  value: string[];
  languageName: (code: string) => string;
  onChange: (locales: string[]) => void;
}

/** Search to add a language; selected languages remain in a separate, removable list. */
export function AdditionalContentLanguages({ inputId, options, primary, value, languageName, onChange }: AdditionalContentLanguagesProps) {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const available = options
    .filter((locale) => locale !== primary && !value.includes(locale))
    .map((locale) => ({ value: locale, label: `${languageName(locale)} (${locale})` }))
    .sort((a, b) => a.label.localeCompare(b.label, i18n.language));

  return (
    <div className="space-y-3">
      <ReactSelect
        inputId={inputId}
        instanceId={inputId}
        options={available}
        value={null}
        onChange={(option) => {
          if (option && option.value !== primary && !value.includes(option.value)) onChange([...value, option.value]);
        }}
        isSearchable
        isClearable={false}
        placeholder={t('settings:addContentLanguage')}
        noOptionsMessage={() => t('settings:noMoreContentLanguages')}
        screenReaderStatus={({ count }) => t('settings:contentLanguagesAvailable', { count })}
        unstyled
        classNames={{
          control: ({ isFocused }) =>
            cn(
              'min-h-11 w-full rounded-field border bg-base-100 px-3 text-sm text-base-content transition-colors',
              isFocused ? 'border-primary ring-2 ring-primary/25' : 'border-base-content/20',
            ),
          input: () => 'text-base-content',
          placeholder: () => 'text-base-content/50',
          dropdownIndicator: () => 'text-base-content/50',
          menu: () => 'relative z-50 mt-1 overflow-hidden rounded-field border border-base-300 bg-base-100 shadow-lg',
          menuList: () => 'max-h-60 overflow-auto py-1',
          option: ({ isFocused }) => cn('cursor-pointer px-3 py-2 text-sm text-base-content', isFocused && 'bg-base-200'),
          noOptionsMessage: () => 'px-3 py-3 text-sm text-base-content/60',
        }}
      />
      {value.length > 0 ? (
        <ul className="divide-y divide-base-300 overflow-hidden rounded-lg border border-base-300" aria-label={t('settings:additionalContentLanguages')}>
          {value.map((locale) => (
            <li key={locale} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
              <span className="text-sm">
                {languageName(locale)} <span className="text-base-content/50">({locale})</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                shape="square"
                className="h-11 min-h-11 w-11 shrink-0 text-base-content/60"
                aria-label={t('settings:removeContentLanguage', { language: languageName(locale) })}
                onClick={() => onChange(value.filter((entry) => entry !== locale))}
              >
                <span aria-hidden="true">&times;</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-base-content/60">{t('settings:noAdditionalContentLanguages')}</p>
      )}
    </div>
  );
}
