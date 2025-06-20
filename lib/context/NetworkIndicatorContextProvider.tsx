import { createContext } from 'react';

interface NetworkIndicatorContextProps {
  isOnline: boolean;
  updateOnlineStatus: (isOnline: boolean) => void;
}

export const NetworkIndicatorContext = createContext<NetworkIndicatorContextProps>({
  isOnline: true,
  updateOnlineStatus: (isOnline: boolean) => {},
});
