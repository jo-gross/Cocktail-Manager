import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER, DEFAULT_SECTION_HEADER } from './partials';

/** Minimal: plain typography, name/price row, no decoration. */
export const minimalTemplate: BuiltInTemplate = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Plain typography with lots of white space; images optional.',
  outputs: ['web', 'monitor', 'print'],
  layout: 'list',
  defaultTokens: {
    colors: { bg: '#ffffff', surface: '#f6f6f6', text: '#111111', muted: '#6b7280', accent: '#111111', accentContrast: '#ffffff' },
    fontHeading: 'inter',
    fontBody: 'inter',
    radius: 4,
    density: 'compact',
  },
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: DEFAULT_SECTION_HEADER,
    item: `<article class="gm-item gm-item--minimal{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
<div class="gm-min-row">
{%- if show.image and item.imageUrl -%}<img class="gm-thumb" src="{{ item.imageUrl }}" alt="" loading="lazy">{%- endif -%}
<div class="gm-min-body">
<div class="gm-min-head"><h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}</h3>{%- include 'gm_price' -%}</div>
{%- include 'gm_ingredients' -%}
{%- if show.description and item.description -%}<div class="gm-description">{{ item.description | markdown }}</div>{%- endif -%}
<div class="gm-meta">{%- include 'gm_badges' -%}{%- include 'gm_alcohol' -%}{%- include 'gm_allergen_icons' -%}{%- include 'gm_tags' -%}</div>
{%- include 'gm_expandables' -%}
</div>
</div>
</article>`,
    item_detail: DEFAULT_ITEM_DETAIL,
    footer: DEFAULT_FOOTER,
  },
  css: `
.gm-header { text-align: left; }
.gm-title { font-weight: 700; letter-spacing: -0.02em; }
.gm-section-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gm-muted); font-weight: 600; }
.gm-min-row { display: flex; gap: 0.75rem; }
.gm-min-body { flex: 1; min-width: 0; }
.gm-min-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
.gm-item-name { font-weight: 600; font-size: 1rem; }
.gm-item--minimal { padding-bottom: calc(var(--gm-space) * 0.75); border-bottom: 1px solid var(--gm-surface); }
.gm-badge { background: var(--gm-surface); color: var(--gm-text); }
.gm-meta:empty { display: none; }
`,
};
