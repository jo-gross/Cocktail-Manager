import { createContext } from 'react';
import { Role, User, UserSetting } from '@prisma/client';
import { WorkspaceFull } from '../../models/WorkspaceFull';

interface UserContextProps {
  user: (User & { settings: UserSetting[] }) | undefined;
  workspace: WorkspaceFull | undefined;

  refreshUser: () => void;
  workspaceRefreshing: boolean;
  refreshWorkspace: () => void;

  isUserPermitted: (role: Role) => boolean;

  updateUserSetting(setting: string, value: string | null): void;

  getTranslation: (key: string, language: 'de') => string;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
  workspaceRefreshing: false,
  refreshUser: () => {},
  refreshWorkspace: () => {},
  updateUserSetting: () => {},
  isUserPermitted: () => false,
  getTranslation: () => '',
});
