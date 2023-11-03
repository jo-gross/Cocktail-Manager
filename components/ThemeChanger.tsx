import React, { useCallback, useEffect, useState } from 'react';
import Checkbox from 'react-three-state-checkbox';

/**
 * This component helps to decide between browser theme and custom light/dark theme mode
 */
export default function ThemeChanger() {
  const [theme, setTheme] = useState('autumn');
  const [autoTheme, setAutoTheme] = useState(true);
  const [lastSelfTheme, setLastSelfTheme] = useState('autumn');

  // Set initial theme
  useEffect(() => {
    setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'halloween' : 'autumn');
  }, []);

  const toggleTheme = useCallback(() => {
    if (autoTheme) {
      setTheme(lastSelfTheme === 'halloween' ? 'autumn' : 'halloween');
      setLastSelfTheme(lastSelfTheme === 'halloween' ? 'autumn' : 'halloween');
    } else {
      setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'halloween' : 'autumn');
    }
  }, [autoTheme, lastSelfTheme]);

  const handleToggleTheme = useCallback(() => {
    setAutoTheme(!autoTheme);
    toggleTheme();
  }, [autoTheme, toggleTheme]);

  const onBrowserThemeChanged = useCallback((callback: (theme: string) => void) => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const mqlListener = (e: MediaQueryListEvent) => callback(e.matches ? 'halloween' : 'autumn');
    mql && mql.addListener(mqlListener);
    return () => mql && mql.removeListener(mqlListener);
  }, []);

  useEffect(() => {
    return onBrowserThemeChanged((theme: string) => {
      if (autoTheme) setTheme(theme);
    });
  }, [autoTheme, onBrowserThemeChanged]);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <label className={'label'}>
      <div className={'label-text'}>Hell</div>
      <Checkbox
        className={'toggle toggle-primary'}
        checked={theme == 'halloween'}
        indeterminate={autoTheme}
        onChange={() => {
          handleToggleTheme();
        }}
      ></Checkbox>
      <div className={'label-text'}>Dark</div>
    </label>
  );
}
