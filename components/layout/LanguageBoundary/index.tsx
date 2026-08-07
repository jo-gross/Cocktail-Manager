import { useContext, useEffect, useRef } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { changeAppLanguage, getActiveLocale, initI18n } from '@lib/i18n/client';
import { isAppLocale, normalizeLocale, type AppLocale } from '@lib/i18n/locales';

initI18n();

interface LanguageBoundaryProps {
  children: React.ReactNode;
}

function getStoredLocale(): AppLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('language');
    return isAppLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export default function LanguageBoundary({ children }: LanguageBoundaryProps) {
  const userContext = useContext(UserContext);
  const initialServerSyncDone = useRef(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getActiveLocale();
    }
  }, []);

  useEffect(() => {
    if (!userContext.user) {
      initialServerSyncDone.current = false;
      return;
    }
    if (initialServerSyncDone.current) return;

    const languageSetting = userContext.user.settings?.find((setting) => setting.setting === 'language');
    if (languageSetting?.value && isAppLocale(languageSetting.value)) {
      void changeAppLanguage(languageSetting.value);
    } else {
      const stored = getStoredLocale();
      if (stored) {
        void changeAppLanguage(stored);
      } else {
        void changeAppLanguage(normalizeLocale(typeof navigator !== 'undefined' ? navigator.language : undefined));
      }
    }
    initialServerSyncDone.current = true;
  }, [userContext.user]);

  return <>{children}</>;
}
