import { createContext } from 'react';
import { Role, User, UserSetting } from '@generated/prisma/client';
import type { WorkspaceDto } from '@lib/schemas/workspace';
import type { TranslationsDto } from '@lib/schemas/translations';

interface UserContextProps {
  user: (User & { settings: UserSetting[] }) | undefined;
  workspace: WorkspaceDto | undefined;
  translations: TranslationsDto;

  refreshUser: () => void;
  workspaceRefreshing: boolean;
  refreshWorkspace: () => void;

  isUserPermitted: (role: Role) => boolean;
  getTranslation: (key: string, language: 'de') => string;
  getTranslationOrNull: (key: string, language: 'de') => string | undefined;

  updateUserSetting(setting: string, value: string | null): void;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
  translations: {},
  workspaceRefreshing: false,
  refreshUser: () => {},
  refreshWorkspace: () => {},
  updateUserSetting: () => {},
  isUserPermitted: () => false,
  getTranslation: () => '',
  getTranslationOrNull: () => '',
});
