/** Theme tokens → CSS variables (light module, safe for client bundles). */
import { GUEST_MENU_FONTS, type ThemeTokens } from './schema';

const DENSITY_FACTOR: Record<ThemeTokens['density'], string> = {
  compact: '0.75',
  comfortable: '1',
  spacious: '1.3',
};

export function getFontStack(fontId: string): string {
  return GUEST_MENU_FONTS.find((font) => font.id === fontId)?.css ?? GUEST_MENU_FONTS[0].css;
}

/** `--gm-bg, --gm-surface, --gm-text, --gm-muted, --gm-accent, --gm-accent-contrast, --gm-font-heading, --gm-font-body, --gm-radius, --gm-density`. */
export function themeToCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    '--gm-bg': tokens.colors.bg,
    '--gm-surface': tokens.colors.surface,
    '--gm-text': tokens.colors.text,
    '--gm-muted': tokens.colors.muted,
    '--gm-accent': tokens.colors.accent,
    '--gm-accent-contrast': tokens.colors.accentContrast,
    '--gm-font-heading': getFontStack(tokens.fontHeading),
    '--gm-font-body': getFontStack(tokens.fontBody),
    '--gm-radius': `${tokens.radius}px`,
    '--gm-density': DENSITY_FACTOR[tokens.density] ?? '1',
  };
}

export function cssVariablesToDeclarations(variables: Record<string, string>): string {
  return Object.entries(variables)
    .filter(([key]) => /^--gm-[a-z0-9-]+$/.test(key))
    .map(([key, value]) => `${key}:${value.replace(/[;{}<>]/g, '')}`)
    .join(';');
}
