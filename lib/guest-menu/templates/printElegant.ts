import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER } from './partials';

/** Print elegant: centered serif layout with thin rules, tuned for A4/A5/DL. */
export const printElegantTemplate: BuiltInTemplate = {
  id: 'print-elegant',
  name: 'Print elegant',
  description: 'Centered serif layout with thin rules, optimized for printed menus.',
  outputs: ['print', 'web'],
  layout: 'list',
  defaultTokens: {
    colors: { bg: '#ffffff', surface: '#ffffff', text: '#1a1a1a', muted: '#555555', accent: '#8a6d3b', accentContrast: '#ffffff' },
    fontHeading: 'playfair-display',
    fontBody: 'lora',
    radius: 0,
    density: 'comfortable',
  },
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: `<header class="gm-section-head gm-pe-head"><h2 class="gm-section-title">{{ section.title }}</h2>
{%- if section.description -%}<div class="gm-section-description">{{ section.description | markdown }}</div>{%- endif -%}</header>`,
    item: `<article class="gm-item gm-item--pe{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
<h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}{%- if show.price and item.priceFormatted -%}<span class="gm-pe-sep" aria-hidden="true"> · </span>{%- include 'gm_price' -%}{%- endif -%}</h3>
{%- include 'gm_ingredients' -%}
{%- if show.description and item.description -%}<div class="gm-description">{{ item.description | markdown }}</div>{%- endif -%}
<div class="gm-meta">{%- include 'gm_badges' -%}{%- include 'gm_alcohol' -%}{%- include 'gm_allergen_icons' -%}</div>
{%- include 'gm_expandables' -%}
</article>`,
    item_detail: DEFAULT_ITEM_DETAIL,
    footer: DEFAULT_FOOTER,
  },
  css: `
.gm-header { padding-top: calc(var(--gm-space) * 3); }
.gm-title { font-weight: 400; letter-spacing: 0.04em; }
.gm-pe-head { text-align: center; }
.gm-pe-head .gm-section-title { font-weight: 400; font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; }
.gm-pe-head::before, .gm-pe-head::after { content: ''; display: block; height: 1px; width: 40%; margin: 0.6rem auto; background: var(--gm-accent); opacity: 0.6; }
.gm-item--pe { text-align: center; }
.gm-item--pe .gm-item-name { font-weight: 400; font-size: 1.15rem; }
.gm-item--pe .gm-price { font-weight: 400; font-family: var(--gm-font-body); }
.gm-item--pe .gm-ingredients { font-style: italic; }
.gm-item--pe .gm-meta { justify-content: center; }
.gm-meta:empty { display: none; }
.gm-badge { background: transparent; color: var(--gm-accent); border: 1px solid var(--gm-accent); }
.gm-footer { text-align: center; border-top: 1px solid var(--gm-muted); margin-top: var(--gm-space); }
.gm-legend-list { justify-content: center; }
`,
};
