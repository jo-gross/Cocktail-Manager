import 'i18next';
import type { resources, defaultNS } from './config';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['de'];
  }
}
