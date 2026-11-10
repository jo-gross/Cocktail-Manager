/**
 * Liquid context reference for the code editor sidebar (see
 * lib/guest-menu/render/index.ts and lib/guest-menu/templates/partials.ts).
 * Entries are code and stay untranslated; group titles/hints are i18n keys.
 */
import { FIELD_KEYS, type TemplateSlot } from '@lib/guest-menu/schema';
import { GUEST_MENU_PARTIALS } from '@lib/guest-menu/templates';

export interface ReferenceEntry {
  /** Shown in the list. */
  label: string;
  /** Inserted at the cursor. */
  snippet: string;
}

export type ReferenceGroupKey = 'item' | 'visibility' | 'section' | 'header' | 'menu' | 'footer' | 'filters' | 'partials' | 'css';

export interface ReferenceGroup {
  /** i18n key below `guestMenu:builder.code.reference.groups.` */
  key: ReferenceGroupKey;
  /** Slots the group is available in; undefined = all. */
  slots?: TemplateSlot[];
  entries: ReferenceEntry[];
}

const variable = (path: string): ReferenceEntry => ({ label: path, snippet: `{{ ${path} }}` });

const ITEM_SLOTS: TemplateSlot[] = ['item', 'item_detail'];

export const CODE_REFERENCE: ReferenceGroup[] = [
  {
    key: 'item',
    slots: ITEM_SLOTS,
    entries: [
      ...[
        'item.name',
        'item.nameOriginal',
        'item.priceFormatted',
        'item.description',
        'item.history',
        'item.imageUrl',
        'item.glass.name',
        'item.highlight',
        'item.rating.average',
      ].map(variable),
      { label: 'item.ingredients', snippet: '{{ item.ingredients | join_names }}' },
      { label: 'item.garnishes', snippet: '{{ item.garnishes | join_names }}' },
      { label: 'item.tags', snippet: '{% for tag in item.tags %}{{ tag.label }}{% endfor %}' },
      { label: 'item.badges', snippet: '{% for badge in item.badges %}{{ badge.label }}{% endfor %}' },
      { label: 'item.amounts', snippet: '{% for entry in item.amounts %}{{ entry.amount }} {{ entry.unit }} {{ entry.name }}{% endfor %}' },
      { label: 'item.unavailable', snippet: '{% if item.unavailable %}{% endif %}' },
      { label: 'item.onRequest', snippet: '{% if item.onRequest %}{% endif %}' },
    ],
  },
  {
    key: 'visibility',
    slots: ITEM_SLOTS,
    entries: [
      ...FIELD_KEYS.map((field) => ({ label: `show.${field}`, snippet: `{% if show.${field} %}{% endif %}` })),
      { label: 'expand.any', snippet: '{% if expand.any %}{% endif %}' },
      { label: 'fields.allergenDisplay', snippet: '{{ fields.allergenDisplay }}' },
      { label: 'fields.alcoholDisplay', snippet: '{{ fields.alcoholDisplay }}' },
    ],
  },
  {
    key: 'section',
    slots: ['section_header', 'item', 'item_detail'],
    entries: ['section.title', 'section.itemCount', 'section.layout']
      .map(variable)
      .concat([{ label: 'section.description', snippet: '{{ section.description | markdown }}' }]),
  },
  {
    key: 'header',
    slots: ['menu_header'],
    entries: [
      { label: 'header.showLogo', snippet: '{% if header.showLogo and theme.logoUrl %}<img src="{{ theme.logoUrl }}" alt="">{% endif %}' },
      { label: 'header.showTitle', snippet: '{% if header.showTitle %}{{ menu.title }}{% endif %}' },
      { label: 'header.showSubtitle', snippet: '{% if header.showSubtitle %}{{ menu.subtitle }}{% endif %}' },
    ],
  },
  {
    key: 'menu',
    entries: [
      'menu.title',
      'menu.subtitle',
      'menu.name',
      'menu.workspaceName',
      'menu.publicPath',
      'theme.logoUrl',
      'theme.backgroundImageUrl',
      'locale',
      'ui_locale',
      'output',
      'layout',
      'currency',
    ].map(variable),
  },
  {
    key: 'footer',
    slots: ['footer'],
    entries: [
      { label: 'footnotes.allergens', snippet: '{% for allergen in footnotes.allergens %}{{ allergen.short }} {{ allergen.label }}{% endfor %}' },
      { label: 'footnotes.additives', snippet: '{% for additive in footnotes.additives %}{{ additive.number }} {{ additive.label }}{% endfor %}' },
      { label: 'notices', snippet: '{% for notice in notices %}{{ notice.markdown | markdown }}{% endfor %}' },
    ],
  },
  {
    key: 'filters',
    entries: [
      { label: 'money', snippet: '{{ item.price | money }}' },
      { label: 't', snippet: "{{ 'item.ingredients' | t }}" },
      { label: 'markdown', snippet: '{{ item.description | markdown }}' },
      { label: 'join_names', snippet: '{{ item.ingredients | join_names }}' },
      { label: 'footnote_marks', snippet: '{{ item | footnote_marks }}' },
      { label: 'allergen_marks', snippet: '{{ item | allergen_marks }}' },
      { label: 'alcohol_label', snippet: '{{ item | alcohol_label }}' },
      { label: 'raw', snippet: '{{ value | raw }}' },
    ],
  },
  {
    key: 'partials',
    slots: ITEM_SLOTS,
    entries: Object.keys(GUEST_MENU_PARTIALS).map((name) => ({ label: name, snippet: `{%- include '${name}' -%}` })),
  },
];

export const CSS_REFERENCE: ReferenceEntry[] = [
  '--gm-bg',
  '--gm-surface',
  '--gm-text',
  '--gm-muted',
  '--gm-accent',
  '--gm-accent-contrast',
  '--gm-font-heading',
  '--gm-font-body',
  '--gm-radius',
  '--gm-density',
  '--gm-space',
]
  .map((name) => ({ label: name, snippet: `var(${name})` }))
  .concat(
    [
      '.gm-menu-header',
      '.gm-section',
      '.gm-section-title',
      '.gm-items',
      '.gm-item',
      '.gm-item-name',
      '.gm-price',
      '.gm-ingredients',
      '.gm-badge',
      '.gm-footer',
    ].map((selector) => ({ label: selector, snippet: `${selector} {\n  \n}\n` })),
  );
