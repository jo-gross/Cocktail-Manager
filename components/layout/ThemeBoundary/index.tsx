import { ThemeContext } from '../../../lib/context/ThemeContextProvider';
import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../../lib/context/UserContextProvider';

interface ThemeBoundaryProps {
  children: React.ReactNode;
  onThemeChange: (isDark: 'dark' | 'auto' | 'light') => void;
}

export default function ThemeBoundary(props: ThemeBoundaryProps) {
  const [theme, setTheme] = useState<'dark' | 'auto' | 'light'>('auto');

  const userContext = useContext(UserContext);

  useEffect(() => {
    console.debug('Settings changed', userContext.user?.settings);
    userContext.user?.settings?.forEach((setting) => {
      if (setting.setting === 'theme' && setting.value != null) {
        setTheme(JSON.parse(setting.value));
      }
    });
  }, [userContext.user?.settings]);

  useEffect(() => {
    props.onThemeChange(theme);
  }, [theme, props]);

  return (
    <>
      <ThemeContext.Provider
        value={{
          theme: theme,
          setTheme: (theme) => {
            userContext.updateUserSetting('theme', JSON.stringify(theme));
          },
        }}
      >
        {props.children}
      </ThemeContext.Provider>
    </>
  );
}
