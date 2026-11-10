import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER } from './partials';

/** Speakeasy: dark background, gold accents, centered art-deco look. */
export const speakeasyTemplate: BuiltInTemplate = {
  id: 'speakeasy',
  name: 'Speakeasy',
  description: 'Dark with gold accents, centered items and ornamental section headers.',
  outputs: ['web', 'monitor', 'print'],
  layout: 'list',
  defaultTokens: {
    colors: { bg: '#121110', surface: '#1d1b19', text: '#f3ead7', muted: '#b6a888', accent: '#c9a24d', accentContrast: '#121110' },
    fontHeading: 'cormorant-garamond',
    fontBody: 'josefin-sans',
    radius: 2,
    density: 'comfortable',
  },
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: `<header class="gm-section-head gm-deco-head">
<span class="gm-deco-line" aria-hidden="true"></span><h2 class="gm-section-title">{{ section.title }}</h2><span class="gm-deco-line" aria-hidden="true"></span>
</header>
{%- if section.description -%}<div class="gm-section-description gm-deco-description">{{ section.description | markdown }}</div>{%- endif -%}`,
    item: `<article class="gm-item gm-item--speakeasy{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
{%- if show.image and item.imageUrl -%}<img class="gm-thumb gm-deco-thumb" src="{{ item.imageUrl }}" alt="" loading="lazy">{%- endif -%}
<h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}</h3>
{%- include 'gm_ingredients' -%}
{%- if show.description and item.description -%}<div class="gm-description">{{ item.description | markdown }}</div>{%- endif -%}
<div class="gm-meta">{%- include 'gm_badges' -%}{%- include 'gm_alcohol' -%}{%- include 'gm_allergen_icons' -%}{%- include 'gm_tags' -%}</div>
{%- include 'gm_price' -%}
{%- include 'gm_expandables' -%}
</article>`,
    item_detail: DEFAULT_ITEM_DETAIL,
    footer: DEFAULT_FOOTER,
  },
  css: `
.gm-title { font-size: clamp(2.2rem, 8cqi, 3.6rem); letter-spacing: 0.08em; text-transform: uppercase; color: var(--gm-accent); font-weight: 500; }
.gm-subtitle { letter-spacing: 0.3em; text-transform: uppercase; font-size: 0.8rem; }
.gm-deco-head { display: flex; align-items: center; gap: 1rem; justify-content: center; }
.gm-deco-head .gm-section-title { font-size: 1.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gm-accent); font-weight: 500; text-align: center; }
.gm-deco-line { flex: 1; max-width: 6rem; height: 1px; background: linear-gradient(90deg, transparent, var(--gm-accent)); }
.gm-deco-line:last-child { background: linear-gradient(90deg, var(--gm-accent), transparent); }
.gm-deco-description { text-align: center; margin-bottom: var(--gm-space); }
.gm-item--speakeasy { text-align: center; display: grid; justify-items: center; gap: 0.2rem; padding: calc(var(--gm-space) * 0.5) 0; }
.gm-item--speakeasy .gm-item-name { font-size: 1.35rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; }
.gm-item--speakeasy .gm-price { color: var(--gm-accent); font-family: var(--gm-font-heading); font-size: 1.15rem; }
.gm-item--speakeasy .gm-meta { justify-content: center; }
.gm-deco-thumb { border-radius: 999px; border: 1px solid var(--gm-accent); }
.gm-badge { border-radius: var(--gm-radius); }
.gm-meta:empty { display: none; }
.gm-footer { text-align: center; }
.gm-legend-list { justify-content: center; }
`,
};
