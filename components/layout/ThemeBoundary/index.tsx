import { ThemeContext } from '../../../lib/context/ThemeContextProvider';
import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../../lib/context/UserContextProvider';

interface ThemeBoundaryProps {
  children: React.ReactNode;
}

export default function ThemeBoundary(props: ThemeBoundaryProps) {
  const [isDark, setIsDark] = useState(false);

  const userContext = useContext(UserContext);

  useEffect(() => {
    console.log('Settings changed', userContext.user?.settings);
    userContext.user?.settings?.forEach((setting) => {
      if (setting.setting === 'theme' && setting.value != null) {
        setIsDark(JSON.parse(setting.value));
      }
    });
  }, [userContext.user?.settings]);

  return (
    <>
      <ThemeContext.Provider
        value={{
          isDark,
          toggleTheme: () => {
            userContext.updateUserSetting('theme', JSON.stringify(!isDark));
          },
        }}
      >
        {props.children}
      </ThemeContext.Provider>
    </>
  );
}
