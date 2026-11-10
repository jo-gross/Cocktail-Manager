import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER, DEFAULT_SECTION_HEADER } from './partials';

/** Monitor compact: large, high-contrast type, one line per drink, multi-column friendly. */
export const monitorCompactTemplate: BuiltInTemplate = {
  id: 'monitor-compact',
  name: 'Monitor compact',
  description: 'Large high-contrast type for screens; one line per drink, no images.',
  outputs: ['monitor', 'web'],
  layout: 'compact',
  defaultTokens: {
    colors: { bg: '#0b0b0c', surface: '#18181b', text: '#fafafa', muted: '#a1a1aa', accent: '#f59e0b', accentContrast: '#0b0b0c' },
    fontHeading: 'oswald',
    fontBody: 'inter',
    radius: 8,
    density: 'compact',
  },
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: DEFAULT_SECTION_HEADER,
    item: `<article class="gm-item gm-item--mc{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
<div class="gm-mc-line"><h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}</h3>{%- include 'gm_badges' -%}<span class="gm-mc-fill" aria-hidden="true"></span>{%- include 'gm_price' -%}</div>
{%- include 'gm_ingredients' -%}
</article>`,
    item_detail: DEFAULT_ITEM_DETAIL,
    footer: DEFAULT_FOOTER,
  },
  css: `
:root { font-size: clamp(16px, 1.6cqi, 28px); }
.gm-header { padding-block: var(--gm-space); }
.gm-title { text-transform: uppercase; letter-spacing: 0.04em; color: var(--gm-accent); }
.gm-section-title { text-transform: uppercase; letter-spacing: 0.06em; color: var(--gm-accent); border-bottom: 2px solid var(--gm-accent); padding-bottom: 0.2rem; }
.gm-mc-line { display: flex; align-items: baseline; gap: 0.5rem; }
.gm-item--mc .gm-item-name { font-size: 1.2rem; font-family: var(--gm-font-heading); font-weight: 500; }
.gm-mc-fill { flex: 1; }
.gm-item--mc .gm-price { font-size: 1.2rem; color: var(--gm-accent); }
.gm-item--mc .gm-ingredients { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gm-item--mc .gm-badges { margin: 0; }
.gm-expand { display: none; }
`,
};
