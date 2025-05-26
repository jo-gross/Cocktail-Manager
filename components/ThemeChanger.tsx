import React, { useContext } from 'react';
import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { MdOutlineBrightnessAuto } from 'react-icons/md';
import { FaMoon, FaSun } from 'react-icons/fa';

/**
 * This component helps to decide between browser theme and custom light/dark theme mode
 */
export default function ThemeChanger() {
  const themeContext = useContext(ThemeContext);

  return (
    <div className={'join self-center'}>
      <button
        className={`btn join-item ${themeContext.theme == 'dark' ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => {
          themeContext.setTheme('dark');
        }}
      >
        <FaMoon />
      </button>
      <button
        className={`btn join-item ${themeContext.theme == 'auto' ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => {
          themeContext.setTheme('auto');
        }}
      >
        <MdOutlineBrightnessAuto />
      </button>
      <button
        className={`btn join-item ${themeContext.theme == 'light' ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => {
          themeContext.setTheme('light');
        }}
      >
        <FaSun />
      </button>
    </div>
  );
}
