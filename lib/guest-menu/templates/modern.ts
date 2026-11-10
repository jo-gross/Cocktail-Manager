import type { BuiltInTemplate } from './base';
import { DEFAULT_FOOTER, DEFAULT_ITEM_DETAIL, DEFAULT_MENU_HEADER, DEFAULT_SECTION_HEADER } from './partials';

/** Modern cards with large images (placeholder initial when there is no image). */
export const modernTemplate: BuiltInTemplate = {
  id: 'modern',
  name: 'Modern',
  description: 'Cards with large images, badges on the image, clean sans-serif type.',
  outputs: ['web', 'monitor'],
  layout: 'cards',
  defaultTokens: {
    colors: { bg: '#f5f5f4', surface: '#ffffff', text: '#18181b', muted: '#71717a', accent: '#0f766e', accentContrast: '#ffffff' },
    fontHeading: 'dm-sans',
    fontBody: 'inter',
    radius: 16,
    density: 'comfortable',
  },
  slots: {
    menu_header: DEFAULT_MENU_HEADER,
    section_header: DEFAULT_SECTION_HEADER,
    item: `<article class="gm-item gm-card{% if item.unavailable %} is-unavailable{% endif %}{% if item.onRequest %} is-on-request{% endif %}{% if item.highlight %} is-highlight{% endif %}">
{%- if show.image -%}
<div class="gm-card-media">
{%- if item.imageUrl -%}<img src="{{ item.imageUrl }}" alt="" loading="lazy">{%- else -%}<span class="gm-card-initial" aria-hidden="true">{{ item.name | slice: 0 }}</span>{%- endif -%}
{%- include 'gm_badges' -%}
</div>
{%- endif -%}
<div class="gm-card-body">
<div class="gm-card-head"><h3 class="gm-item-name">{{ item.name }}{%- include 'gm_marks' -%}</h3>{%- include 'gm_price' -%}</div>
{%- unless show.image -%}{%- include 'gm_badges' -%}{%- endunless -%}
{%- include 'gm_ingredients' -%}
{%- if show.description and item.description -%}<div class="gm-description">{{ item.description | markdown }}</div>{%- endif -%}
<div class="gm-meta">{%- include 'gm_alcohol' -%}{%- include 'gm_allergen_icons' -%}{%- include 'gm_tags' -%}</div>
{%- include 'gm_expandables' -%}
</div>
</article>`,
    item_detail: DEFAULT_ITEM_DETAIL,
    footer: DEFAULT_FOOTER,
  },
  css: `
.gm-section-title { font-size: 1.6rem; font-weight: 700; }
.gm-card {
  background: var(--gm-surface); border-radius: var(--gm-radius); overflow: hidden; height: 100%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.05); display: flex; flex-direction: column;
}
.gm-card-media { position: relative; aspect-ratio: 4 / 3; background: color-mix(in srgb, var(--gm-accent) 12%, var(--gm-surface)); }
.gm-card-media img { width: 100%; height: 100%; object-fit: cover; }
.gm-card-initial {
  position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--gm-font-heading);
  font-size: 3rem; color: var(--gm-accent); opacity: 0.6;
}
.gm-card-media .gm-badges { position: absolute; top: 0.6rem; left: 0.6rem; margin: 0; }
.gm-card-body { padding: calc(var(--gm-space) * 0.9); display: grid; gap: 0.25rem; }
.gm-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
.gm-card .gm-price { color: var(--gm-accent); }
.gm-meta:empty { display: none; }
.is-highlight.gm-card { outline: 2px solid var(--gm-accent); }
`,
};
