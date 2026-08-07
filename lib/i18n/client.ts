import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { i18nInitOptions } from './config';
import { normalizeLocale, type AppLocale } from './locales';
import './types';

let initialized = false;

export function initI18n() {
  if (initialized) return i18n;
  initialized = true;

  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...i18nInitOptions,
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'language',
      },
    });

  return i18n;
}

export async function changeAppLanguage(locale: AppLocale) {
  const normalized = normalizeLocale(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
  try {
    localStorage.setItem('language', normalized);
  } catch {
    // ignore
  }
  await i18n.changeLanguage(normalized);
}

export function getActiveLocale(): AppLocale {
  return normalizeLocale(i18n.language);
}

export { i18n };
