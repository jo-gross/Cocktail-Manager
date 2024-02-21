import { createContext } from 'react';

interface ThemeContextProps {
  theme: 'dark' | 'auto' | 'light';
  setTheme: (theme: 'dark' | 'auto' | 'light') => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: 'auto',
  setTheme: () => {},
});
