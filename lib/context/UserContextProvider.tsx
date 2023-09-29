import { createContext } from 'react';
import { User, UserSetting, Workspace } from '@prisma/client';

interface UserContextProps {
  user: (User & { settings: UserSetting[] }) | undefined;
  workspace: Workspace | undefined;

  refreshUser: () => void;
  workspaceRefreshing: boolean;
  refreshWorkspace: () => void;
  isUserAdmin: () => boolean;
  isUserManager: () => boolean;

  updateUserSetting(setting: string, value: string | null): void;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
  workspaceRefreshing: false,
  refreshUser: () => {},
  refreshWorkspace: () => {},
  isUserAdmin: () => false,
  isUserManager: () => false,
  updateUserSetting: () => {},
});
