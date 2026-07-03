import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { useContext, useEffect, useRef, useState } from 'react';
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
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export default function ThemeBoundary(props: ThemeBoundaryProps) {
  const [theme, setTheme] = useState<'dark' | 'auto' | 'light'>(getInitialTheme);
  const initialServerSyncDone = useRef(false);

  const userContext = useContext(UserContext);

  // Apply server theme once on initial user load (not on every fetchUser)
  useEffect(() => {
    if (!userContext.user) {
      initialServerSyncDone.current = false;
      return;
    }
    if (initialServerSyncDone.current) return;

    userContext.user.settings?.forEach((setting) => {
      if (setting.setting === 'theme' && setting.value != null) {
        setTheme(JSON.parse(setting.value));
      }
    });
    initialServerSyncDone.current = true;
  }, [userContext.user?.id]);

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
          // Persist to server only when a user is signed in
          if (userContext.user) {
            userContext.updateUserSetting('theme', JSON.stringify(newTheme));
          }
        },
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
}
