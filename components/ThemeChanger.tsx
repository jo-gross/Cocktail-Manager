import React, { useContext } from 'react';
import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { MdOutlineBrightnessAuto } from 'react-icons/md';
import { FaMoon, FaSun } from 'react-icons/fa';

interface ThemeChangerProps {
  disabled?: boolean;
}

/**
 * This component helps to decide between browser theme and custom light/dark theme mode
 */
export default function ThemeChanger({ disabled = false }: ThemeChangerProps) {
  const themeContext = useContext(ThemeContext);

  return (
    <div className={`join self-center ${disabled ? 'opacity-50' : ''}`}>
      <button
        className={`btn join-item ${themeContext.theme == 'dark' ? 'btn-primary' : 'btn-outline'}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('dark');
          }
        }}
      >
        <FaMoon />
      </button>
      <button
        className={`btn join-item ${themeContext.theme == 'auto' ? 'btn-primary' : 'btn-outline'}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('auto');
          }
        }}
      >
        <MdOutlineBrightnessAuto />
      </button>
      <button
        className={`btn join-item ${themeContext.theme == 'light' ? 'btn-primary' : 'btn-outline'}`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('light');
          }
        }}
      >
        <FaSun />
      </button>
    </div>
  );
}
