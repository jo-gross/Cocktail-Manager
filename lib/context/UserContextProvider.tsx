import { createContext } from 'react';
import { Role, User, UserSetting, Workspace } from '@prisma/client';

interface UserContextProps {
  user: (User & { settings: UserSetting[] }) | undefined;
  workspace: Workspace | undefined;

  refreshUser: () => void;
  workspaceRefreshing: boolean;
  refreshWorkspace: () => void;

  isUserPermitted: (role: Role) => boolean;

  updateUserSetting(setting: string, value: string | null): void;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
  workspaceRefreshing: false,
  refreshUser: () => {},
  refreshWorkspace: () => {},
  updateUserSetting: () => {},
  isUserPermitted: () => false,
});
