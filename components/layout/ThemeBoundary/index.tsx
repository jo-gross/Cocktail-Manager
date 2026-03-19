import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { useContext, useEffect, useState } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';

interface ThemeBoundaryProps {
  children: React.ReactNode;
}

function getInitialTheme(): 'dark' | 'auto' | 'light' {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = localStorage.getItem('theme');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed === 'dark' || parsed === 'light' || parsed === 'auto') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return 'auto';
}

function applyThemeToDOM(theme: 'dark' | 'auto' | 'light') {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'halloween');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'autumn');
  } else {
    // auto: remove data-theme so daisyUI uses prefers-color-scheme with darkTheme config
    document.documentElement.removeAttribute('data-theme');
  }
}

export default function ThemeBoundary(props: ThemeBoundaryProps) {
  const [theme, setTheme] = useState<'dark' | 'auto' | 'light'>(getInitialTheme);

  const userContext = useContext(UserContext);

  // Sync theme from user settings (API) when available
  useEffect(() => {
    userContext.user?.settings?.forEach((setting) => {
      if (setting.setting === 'theme' && setting.value != null) {
        const serverTheme = JSON.parse(setting.value);
        setTheme((prev) => {
          if (prev !== serverTheme) {
            return serverTheme;
          }
          return prev;
        });
      }
    });
  }, [userContext.user?.settings]);

  // Apply theme to DOM and persist to localStorage whenever it changes
  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem('theme', JSON.stringify(theme));
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: theme,
        setTheme: (newTheme) => {
          // Apply immediately for instant feedback
          setTheme(newTheme);
          applyThemeToDOM(newTheme);
          try {
            localStorage.setItem('theme', JSON.stringify(newTheme));
          } catch {
            // ignore
          }
          // Persist to server
          userContext.updateUserSetting('theme', JSON.stringify(newTheme));
        },
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
}
