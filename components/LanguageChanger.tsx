import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, type ButtonSize } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { changeAppLanguage } from '@lib/i18n/client';
import { LOCALE_FLAGS, type AppLocale } from '@lib/i18n/locales';
import { Setting } from '@generated/prisma/client';

interface LanguageChangerProps {
  disabled?: boolean;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export default function LanguageChanger({ disabled = false, size, fullWidth = false }: LanguageChangerProps) {
  const { t } = useTranslation('settings');
  const userContext = useContext(UserContext);
  const current = userContext.uiLocale;

  const setLanguage = async (locale: AppLocale) => {
    if (disabled) return;
    await changeAppLanguage(locale);
    if (userContext.user) {
      userContext.updateUserSetting(Setting.language, locale);
    }
  };

  return (
    <ButtonGroup className={`${fullWidth ? 'w-full' : 'self-center'} ${disabled ? 'opacity-50' : ''}`} aria-label={t('language.label')}>
      <Button
        joinItem
        size={size}
        className={fullWidth ? 'min-w-0 flex-1' : undefined}
        variant={current === 'de' ? 'primary' : 'outline'}
        disabled={disabled}
        onClick={() => void setLanguage('de')}
      >
        <span aria-hidden="true">{LOCALE_FLAGS.de}</span> {t('labelDe')}
      </Button>
      <Button
        joinItem
        size={size}
        className={fullWidth ? 'min-w-0 flex-1' : undefined}
        variant={current === 'en' ? 'primary' : 'outline'}
        disabled={disabled}
        onClick={() => void setLanguage('en')}
      >
        <span aria-hidden="true">{LOCALE_FLAGS.en}</span> {t('labelEn')}
      </Button>
    </ButtonGroup>
  );
}
