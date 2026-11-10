/**
 * Base CSS shared by all built-in templates (prepended to each template's CSS
 * before scoping). Uses only theme variables (`--gm-*`), container queries on
 * `.gm-root` and respects `prefers-reduced-motion`.
 *
 * DOM contract (produced by `composeMenuHtml` and the React GuestMenuShell):
 *   .gm-root[data-gm][data-output][data-layout][data-template]
 *     .gm-menu-header            ← menu_header slot
 *     .gm-block.gm-block--text|image|divider|notice
 *     section.gm-section#gm-section-<id>
 *       .gm-section-header       ← section_header slot
 *       .gm-items[data-layout]
 *         .gm-item-wrap[data-item-id]   ← item slot (article.gm-item)
 *     .gm-menu-footer            ← footer slot
 */
import type { GuestMenuOutput, GuestMenuLayout, TemplateSlot, ThemeTokens } from '../schema';

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  /** Outputs this template is designed for (others still work). */
  outputs: GuestMenuOutput[];
  /** Suggested layout for new menus using this template. */
  layout: GuestMenuLayout;
  /** Theme tokens applied when the user picks this template's look. */
  defaultTokens: ThemeTokens;
  slots: Record<TemplateSlot, string>;
  /** Template CSS (unscoped; scoped to `.gm-root[data-gm=…]` at render time). */
  css: string;
}

export const BASE_CSS = `
:root {
  container-type: inline-size;
  container-name: gm;
  --gm-space: calc(1rem * var(--gm-density, 1));
  background: var(--gm-bg);
  color: var(--gm-text);
  font-family: var(--gm-font-body);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
h1, h2, h3, h4 { font-family: var(--gm-font-heading); margin: 0; line-height: 1.2; }
p { margin: 0; }
img { max-width: 100%; display: block; }
a { color: var(--gm-accent); }
:where(.gm-text, .gm-description, .gm-section-description, .gm-detail-description, .gm-history, .gm-detail-history, .gm-notice, .gm-footer-notice) ul { list-style: disc; padding-left: 1.25rem; margin: 0.4em 0; }
:where(.gm-text, .gm-description, .gm-section-description, .gm-detail-description, .gm-history, .gm-detail-history, .gm-notice, .gm-footer-notice) ol { list-style: decimal; padding-left: 1.25rem; margin: 0.4em 0; }
:where(.gm-text, .gm-description, .gm-detail-description, .gm-history, .gm-detail-history, .gm-notice) p + p { margin-top: 0.5em; }
.gm-text h3, .gm-text h4, .gm-text h5 { margin: 0.6em 0 0.3em; }

.gm-header { text-align: center; padding: calc(var(--gm-space) * 2) var(--gm-space) var(--gm-space); }
.gm-logo { max-height: 96px; width: auto; margin: 0 auto var(--gm-space); }
.gm-title { font-size: clamp(1.8rem, 6cqi, 3rem); }
.gm-subtitle { color: var(--gm-muted); margin-top: calc(var(--gm-space) * 0.4); white-space: pre-line; }

.gm-section { padding: var(--gm-space); scroll-margin-top: 7rem; }
.gm-section-head { margin-bottom: var(--gm-space); }
.gm-section-title { font-size: 1.5rem; }
.gm-section-description { color: var(--gm-muted); margin-top: 0.25rem; }

.gm-items { display: grid; gap: var(--gm-space); grid-template-columns: 1fr; }
.gm-items[data-layout="compact"] { gap: calc(var(--gm-space) * 0.5); }
.gm-item-wrap { min-width: 0; }
.gm-item-wrap[data-interactive="true"] { cursor: pointer; border-radius: var(--gm-radius); }
.gm-item-wrap[data-interactive="true"]:focus-visible { outline: 2px solid var(--gm-accent); outline-offset: 2px; }

.gm-item { position: relative; }
.gm-item-name { font-size: 1.1rem; font-weight: 600; }
.gm-price { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.gm-ingredients, .gm-description, .gm-tags-text { color: var(--gm-muted); font-size: 0.92rem; margin-top: 0.2rem; }
.gm-marks { font-size: 0.65em; color: var(--gm-muted); margin-left: 0.15em; font-weight: 400; }

.gm-badges { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
.gm-badge {
  display: inline-block; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
  padding: 0.12rem 0.5rem; border-radius: 999px; background: var(--gm-accent); color: var(--gm-accent-contrast);
}
.gm-badge--alcoholFree { background: transparent; color: var(--gm-accent); border: 1px solid var(--gm-accent); }
.gm-badge--unavailable { background: var(--gm-muted); color: var(--gm-bg); }
.gm-badge--onRequest { background: transparent; color: var(--gm-muted); border: 1px dashed var(--gm-muted); }

.gm-tags { display: inline-flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
.gm-tag {
  font-size: 0.75rem; padding: 0.05rem 0.45rem; border-radius: 999px;
  border: 1px solid var(--gm-tag-color, var(--gm-muted)); color: var(--gm-text);
}
.gm-alcohol { font-size: 0.8rem; color: var(--gm-muted); }
.gm-allergens--icons { display: inline-flex; gap: 0.15rem; font-size: 0.95rem; }
.gm-allergen-icon--optional { opacity: 0.55; }
.gm-allergens--codes { font-size: 0.8rem; color: var(--gm-muted); }
.gm-allergens--codes abbr { text-decoration: none; }

.gm-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.75rem; margin-top: 0.3rem; }

.gm-expand { margin-top: 0.35rem; font-size: 0.9rem; }
.gm-expand > summary { cursor: pointer; color: var(--gm-accent); min-height: 44px; display: flex; align-items: center; width: fit-content; }
.gm-expand-body { display: grid; gap: 0.3rem; color: var(--gm-muted); }

.is-unavailable { opacity: 0.5; filter: grayscale(0.6); }
.is-unavailable .gm-item-name { text-decoration: line-through; text-decoration-thickness: 1px; }
.is-on-request { opacity: 0.85; }

.gm-thumb { width: 64px; height: 64px; border-radius: var(--gm-radius); object-fit: cover; flex: none; background: var(--gm-surface); }

.gm-block--text, .gm-block--notice, .gm-block--image { padding: var(--gm-space); }
.gm-block--notice .gm-notice {
  border: 1px solid color-mix(in srgb, var(--gm-text) 12%, transparent); padding: var(--gm-space);
  border-radius: calc(var(--gm-radius) * 0.5); color: var(--gm-muted); font-size: 0.92rem;
}
.gm-block--image img { border-radius: var(--gm-radius); margin: 0 auto; }
.gm-divider { border: 0; border-top: 1px solid var(--gm-muted); opacity: 0.35; margin: var(--gm-space); }

.gm-footer { padding: calc(var(--gm-space) * 1.5) var(--gm-space); color: var(--gm-muted); font-size: 0.82rem; display: grid; gap: var(--gm-space); }
.gm-legend-title { font-size: 0.85rem; margin-bottom: 0.3rem; font-family: var(--gm-font-body); }
.gm-legend-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; }

.gm-detail { display: grid; gap: 0.7rem; }
.gm-detail-image { width: 100%; max-height: 50vh; object-fit: cover; border-radius: var(--gm-radius); }
.gm-detail-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
.gm-detail-name { font-size: 1.6rem; }
.gm-detail-original { color: var(--gm-muted); font-style: italic; }
.gm-detail-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gm-muted); font-family: var(--gm-font-body); }
.gm-detail-list { margin: 0; padding-left: 1.1rem; }
.gm-detail-hint { font-size: 0.8rem; color: var(--gm-muted); font-style: italic; }
.gm-detail-history > summary { cursor: pointer; color: var(--gm-accent); min-height: 44px; display: flex; align-items: center; }

/* Tiles & gallery: every item becomes a card with an image area on top and a
   stacked name/price, independent of the item markup of the template.
   Selectors are deliberately specific so template list styles do not leak in. */
.gm-item-slot { height: 100%; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item {
  --gm-tile-pad: calc(var(--gm-space) * 0.75);
  height: 100%; margin: 0; padding: 0; background: var(--gm-surface); border-radius: var(--gm-radius); overflow: hidden;
  display: flex; flex-direction: column; gap: 0; text-align: left; justify-items: stretch; border: 0;
}
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item:not(.gm-card) { padding: var(--gm-tile-pad); gap: 0.3rem; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap :is(.gm-row, .gm-min-row) { display: flex; flex-direction: column; gap: 0.3rem; align-items: stretch; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap :is(.gm-body, .gm-min-body, .gm-card-body) { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item:not(.gm-card) .gm-thumb,
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item:not(.gm-card):not(:has(.gm-thumb))::before {
  display: block; width: calc(100% + 2 * var(--gm-tile-pad)); max-width: none; height: auto; aspect-ratio: 4 / 3; object-fit: cover;
  margin: calc(-1 * var(--gm-tile-pad)) calc(-1 * var(--gm-tile-pad)) 0.35rem; border: 0; border-radius: 0; flex: none;
}
/* Keep the grid even when a cocktail has no image. */
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item:not(.gm-card):not(:has(.gm-thumb))::before {
  content: ''; background: color-mix(in srgb, var(--gm-accent) 10%, var(--gm-surface));
}
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-leader { display: none; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap :is(.gm-line, .gm-min-head, .gm-card-head) { display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap :is(.gm-item-name, .gm-ingredients, .gm-description) { overflow-wrap: anywhere; text-align: left; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-item-name { line-height: 1.25; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap :is(.gm-meta, .gm-badges) { justify-content: flex-start; }
:is(.gm-items[data-layout="tiles"], .gm-items[data-layout="gallery"]) > .gm-item-wrap .gm-price { text-align: left; }

.gm-items[data-layout="tiles"] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: calc(var(--gm-space) * 0.6); }
.gm-items[data-layout="tiles"] > .gm-item-wrap .gm-item-name { font-size: 0.98rem; letter-spacing: normal; text-transform: none; }
.gm-items[data-layout="tiles"] > .gm-item-wrap .gm-price { font-size: 0.95rem; }
.gm-items[data-layout="tiles"] > .gm-item-wrap .gm-ingredients {
  font-size: 0.8rem; margin: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
/* Tiles stay compact; longer texts and details live in the detail sheet. */
.gm-items[data-layout="tiles"] > .gm-item-wrap :is(.gm-description, .gm-expand, .gm-tags, .gm-alcohol, .gm-allergens--codes) { display: none; }
.gm-items[data-layout="tiles"] > .gm-item-wrap .gm-meta:not(:has(.gm-badge, .gm-allergens--icons)) { display: none; }
.gm-items[data-layout="tiles"] > .gm-item-wrap .gm-card-initial { font-size: 2rem; }

.gm-items[data-layout="gallery"] {
  grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: min(80%, 20rem);
  overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none;
  margin-inline: calc(-1 * var(--gm-space)); padding: 0.25rem var(--gm-space) 0.75rem; scroll-padding-inline: var(--gm-space);
}
.gm-items[data-layout="gallery"]::-webkit-scrollbar { display: none; }
.gm-items[data-layout="gallery"] > .gm-item-wrap { scroll-snap-align: start; }

@container gm (min-width: 640px) {
  .gm-items[data-layout="grid"], .gm-items[data-layout="cards"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gm-items[data-layout="tiles"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .gm-items[data-layout="gallery"] {
    grid-auto-flow: row; grid-auto-columns: auto; grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible; margin-inline: 0; padding: 0; scroll-snap-type: none;
  }
  .gm-items[data-layout="compact"] { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: calc(var(--gm-space) * 2); }
}
@container gm (min-width: 1000px) {
  .gm-items[data-layout="grid"], .gm-items[data-layout="cards"], .gm-items[data-layout="gallery"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .gm-items[data-layout="tiles"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .gm-section { padding-inline: calc(var(--gm-space) * 2); }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
@media print {
  :root { background: #fff; }
  .gm-section { break-inside: auto; }
  .gm-item-wrap { break-inside: avoid; }
  .gm-expand > summary { display: none; }
}
`;
