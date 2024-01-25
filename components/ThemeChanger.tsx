import React, { useContext } from 'react';
import { ThemeContext } from '../lib/context/ThemeContextProvider';

/**
 * This component helps to decide between browser theme and custom light/dark theme mode
 */
export default function ThemeChanger() {
  // const [theme, setTheme] = useState('autumn');
  // const [autoTheme, setAutoTheme] = useState(true);
  // const [lastSelfTheme, setLastSelfTheme] = useState('autumn');

  // // Set initial theme
  // useEffect(() => {
  //   setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'halloween' : 'autumn');
  // }, []);
  //
  // const toggleTheme = useCallback(() => {
  //   if (autoTheme) {
  //     setTheme(lastSelfTheme === 'halloween' ? 'autumn' : 'halloween');
  //     setLastSelfTheme(lastSelfTheme === 'halloween' ? 'autumn' : 'halloween');
  //   } else {
  //     setTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'halloween' : 'autumn');
  //   }
  // }, [autoTheme, lastSelfTheme]);
  //
  // const handleToggleTheme = useCallback(() => {
  //   setAutoTheme(!autoTheme);
  //   toggleTheme();
  // }, [autoTheme, toggleTheme]);
  //
  // const onBrowserThemeChanged = useCallback((callback: (theme: string) => void) => {
  //   const mql = window.matchMedia('(prefers-color-scheme: dark)');
  //   const mqlListener = (e: MediaQueryListEvent) => callback(e.matches ? 'halloween' : 'autumn');
  //   mql && mql.addListener(mqlListener);
  //   return () => mql && mql.removeListener(mqlListener);
  // }, []);
  //
  // useEffect(() => {
  //   return onBrowserThemeChanged((theme: string) => {
  //     if (autoTheme) setTheme(theme);
  //   });
  // }, [autoTheme, onBrowserThemeChanged]);
  //
  // useEffect(() => {
  //   document.querySelector('html')?.setAttribute('data-theme', theme);
  // }, [theme]);

  // return (
  //   <label className={'label'}>
  //     <div className={'label-text'}>Hell</div>
  //     <Checkbox
  //       className={'toggle toggle-primary'}
  //       checked={theme == 'halloween'}
  //       indeterminate={autoTheme}
  //       onChange={() => {
  //         handleToggleTheme();
  //       }}
  //     ></Checkbox>
  //     <div className={'label-text'}>Dark</div>
  //   </label>
  // );

  const themeContext = useContext(ThemeContext);

  return (
    <label className="flex w-full cursor-pointer justify-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
      <input type="checkbox" value="halloween" checked={themeContext.isDark} onChange={themeContext.toggleTheme} className="theme-controller toggle" />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </label>
  );
}
