import type { InitOptions } from 'i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales';

import commonDe from '../../locales/de/common.json';
import navDe from '../../locales/de/nav.json';
import authDe from '../../locales/de/auth.json';
import cocktailDe from '../../locales/de/cocktail.json';
import ingredientDe from '../../locales/de/ingredient.json';
import settingsDe from '../../locales/de/settings.json';
import errorsDe from '../../locales/de/errors.json';
import entityDe from '../../locales/de/entity.json';
import importDe from '../../locales/de/import.json';
import orderDe from '../../locales/de/order.json';
import statisticsDe from '../../locales/de/statistics.json';
import monitorDe from '../../locales/de/monitor.json';
import manageDe from '../../locales/de/manage.json';

import commonEn from '../../locales/en/common.json';
import navEn from '../../locales/en/nav.json';
import authEn from '../../locales/en/auth.json';
import cocktailEn from '../../locales/en/cocktail.json';
import ingredientEn from '../../locales/en/ingredient.json';
import settingsEn from '../../locales/en/settings.json';
import errorsEn from '../../locales/en/errors.json';
import entityEn from '../../locales/en/entity.json';
import importEn from '../../locales/en/import.json';
import orderEn from '../../locales/en/order.json';
import statisticsEn from '../../locales/en/statistics.json';
import monitorEn from '../../locales/en/monitor.json';
import manageEn from '../../locales/en/manage.json';

export const defaultNS = 'common';

export const namespaces = [
  'common',
  'nav',
  'auth',
  'cocktail',
  'ingredient',
  'settings',
  'errors',
  'entity',
  'import',
  'order',
  'statistics',
  'monitor',
  'manage',
] as const;

export type TranslationNamespace = (typeof namespaces)[number];

export const resources = {
  de: {
    common: commonDe,
    nav: navDe,
    auth: authDe,
    cocktail: cocktailDe,
    ingredient: ingredientDe,
    settings: settingsDe,
    errors: errorsDe,
    entity: entityDe,
    import: importDe,
    order: orderDe,
    statistics: statisticsDe,
    monitor: monitorDe,
    manage: manageDe,
  },
  en: {
    common: commonEn,
    nav: navEn,
    auth: authEn,
    cocktail: cocktailEn,
    ingredient: ingredientEn,
    settings: settingsEn,
    errors: errorsEn,
    entity: entityEn,
    import: importEn,
    order: orderEn,
    statistics: statisticsEn,
    monitor: monitorEn,
    manage: manageEn,
  },
} as const;

export const i18nInitOptions: InitOptions = {
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  defaultNS,
  ns: [...namespaces],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  react: {
    useSuspense: false,
  },
};
