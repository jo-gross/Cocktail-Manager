import React, { useContext } from 'react';
import { Button, ButtonGroup, type ButtonSize } from '@components/ui';
import { ThemeContext } from '@lib/context/ThemeContextProvider';
import { MdOutlineBrightnessAuto } from 'react-icons/md';
import { FaMoon, FaSun } from 'react-icons/fa';

interface ThemeChangerProps {
  disabled?: boolean;
  size?: ButtonSize;
}

/**
 * This component helps to decide between browser theme and custom light/dark theme mode
 */
export default function ThemeChanger({ disabled = false, size }: ThemeChangerProps) {
  const themeContext = useContext(ThemeContext);

  return (
    <ButtonGroup className={`self-center ${disabled ? 'opacity-50' : ''}`}>
      <Button
        joinItem
        size={size}
        variant={themeContext.theme == 'dark' ? 'primary' : 'outline'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('dark');
          }
        }}
      >
        <FaMoon />
      </Button>
      <Button
        joinItem
        size={size}
        variant={themeContext.theme == 'auto' ? 'primary' : 'outline'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('auto');
          }
        }}
      >
        <MdOutlineBrightnessAuto />
      </Button>
      <Button
        joinItem
        size={size}
        variant={themeContext.theme == 'light' ? 'primary' : 'outline'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            themeContext.setTheme('light');
          }
        }}
      >
        <FaSun />
      </Button>
    </ButtonGroup>
  );
}
