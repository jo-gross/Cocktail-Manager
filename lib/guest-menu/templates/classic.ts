import { DEFAULT_THEME } from '../schema';
import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER } from './partials';

/** Classic menu: serif headings, dotted leader between name and price, small round thumbnails. */
export const classicTemplate: BuiltInTemplate = {
  id: 'classic',
  name: 'Classic',
  description: 'Serif headings, dotted leader to the price, optional small images.',
  outputs: ['web', 'monitor', 'print'],
  layout: 'list',
  defaultTokens: structuredClone(DEFAULT_THEME.tokens),
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: `<header class="gm-section-head gm-section-head--classic">
<h2 class="gm-section-title">{{ section.title }}</h2>
{%- if section.description -%}<div class="gm-section-description">{{ section.description | markdown }}</div>{%- endif -%}
</header>`,
    item: `<article class="gm-item gm-item--classic{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
<div class="gm-row">
{%- if show.image and item.imageUrl -%}<img class="gm-thumb" src="{{ item.imageUrl }}" alt="" loading="lazy">{%- endif -%}
<div class="gm-body">
<div class="gm-line"><h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}</h3><span class="gm-leader" aria-hidden="true"></span>{%- include 'gm_price' -%}</div>
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
.gm-section-head--classic { text-align: center; }
.gm-section-head--classic .gm-section-title { font-size: 1.7rem; font-style: italic; }
.gm-section-head--classic .gm-section-title::after {
  content: ''; display: block; width: 3rem; height: 1px; background: var(--gm-accent); margin: 0.5rem auto 0;
}
.gm-row { display: flex; gap: 0.85rem; align-items: flex-start; }
.gm-body { flex: 1; min-width: 0; }
.gm-line { display: flex; align-items: baseline; gap: 0.4rem; }
.gm-line .gm-item-name { font-family: var(--gm-font-heading); font-size: 1.15rem; }
.gm-leader { flex: 1; border-bottom: 2px dotted var(--gm-muted); opacity: 0.5; transform: translateY(-0.25em); min-width: 1rem; }
.gm-thumb { border-radius: 999px; width: 56px; height: 56px; }
.gm-meta:empty { display: none; }
.is-highlight .gm-item-name { color: var(--gm-accent); }
`,
};
