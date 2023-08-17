import { createContext } from 'react';
import { User, Workspace } from '@prisma/client';

interface UserContextProps {
  user: User | undefined;
  workspace: Workspace | undefined;
}

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  workspace: undefined,
});
