import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, type ButtonSize } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { changeAppLanguage } from '@lib/i18n/client';
import type { AppLocale } from '@lib/i18n/locales';
import { Setting } from '@generated/prisma/client';

interface LanguageChangerProps {
  disabled?: boolean;
  size?: ButtonSize;
}

export default function LanguageChanger({ disabled = false, size }: LanguageChangerProps) {
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
    <ButtonGroup className={`self-center ${disabled ? 'opacity-50' : ''}`} aria-label={t('language.label')}>
      <Button joinItem size={size} variant={current === 'de' ? 'primary' : 'outline'} disabled={disabled} onClick={() => void setLanguage('de')}>
        DE
      </Button>
      <Button joinItem size={size} variant={current === 'en' ? 'primary' : 'outline'} disabled={disabled} onClick={() => void setLanguage('en')}>
        EN
      </Button>
    </ButtonGroup>
  );
}
