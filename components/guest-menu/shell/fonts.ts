/**
 * Self-hosted guest menu fonts (GUEST_MENU_FONTS in lib/guest-menu/schema.ts) via
 * @fontsource – bundled by webpack, no third-party requests. Only the @font-face
 * rules are global; font files are downloaded on demand by the browser
 * (unicode-range subsets, only when a family is actually used).
 * Imported by the guest shell only (public page + builder preview).
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/raleway/400.css';
import '@fontsource/raleway/700.css';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/josefin-sans/700.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/700.css';
import '@fontsource/lora/400-italic.css';
import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/700.css';

export const GUEST_MENU_FONTS_LOADED = true;
