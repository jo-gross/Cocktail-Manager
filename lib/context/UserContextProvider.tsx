import { createContext } from 'react';
import { Role, User, UserSetting } from '@generated/prisma/client';
import type { WorkspaceDto } from '@lib/schemas/workspace';
import type { TranslationsDto } from '@lib/schemas/translations';
import type { AppLocale } from '@lib/i18n/locales';
import { DEFAULT_LOCALE } from '@lib/i18n/locales';

interface UserContextProps {
  user: (User & { settings: UserSetting[] }) | undefined;
  workspace: WorkspaceDto | undefined;
  translations: TranslationsDto;
  /** Active UI locale for entity labels (`getTranslation`). Kept in React state so locale changes re-render consumers. */
  uiLocale: AppLocale;

  refreshUser: () => void;
  workspaceRefreshing: boolean;
  refreshWorkspace: () => Promise<void>;

  /** Merge labels for one translation key into local catalog (immediate UI update after save). */
  patchTranslations: (key: string, labels: Record<string, string>) => void;

  isUserPermitted: (role: Role) => boolean;
  getTranslation: (key: string, language?: AppLocale) => string;
  getTranslationOrNull: (key: string, language?: AppLocale) => string | undefined;

  updateUserSetting(setting: string, value: string | null): void;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
  translations: {},
  uiLocale: DEFAULT_LOCALE,
  workspaceRefreshing: false,
  refreshUser: () => {},
  refreshWorkspace: async () => {},
  patchTranslations: () => {},
  updateUserSetting: () => {},
  isUserPermitted: () => false,
  getTranslation: () => '',
  getTranslationOrNull: () => '',
});
