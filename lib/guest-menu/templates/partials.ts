/**
 * Shared Liquid partials available to every template via `{% include '<name>' %}`
 * (they read `item`, `show`, `expand`, `fields` from the including scope).
 * These are the ONLY loadable templates – the engine has no file system access.
 *
 * Item-slot scope: `item` (PublicMenuItemDto), `section`, `fields` (effective
 * FieldConfig), `show.<field>` (true if the field is shown in this slot),
 * `expand.<field>` (true if shown behind a <details> toggle in the list),
 * `menu`, `theme`, `output`, `locale`, `ui_locale`, `layout`, `currency`.
 */

export const GM_BADGES = `{%- capture gm_badges_out -%}
{%- for badge in item.badges -%}
{%- if show.badges or badge.kind == 'unavailable' or badge.kind == 'onRequest' -%}<span class="gm-badge gm-badge--{{ badge.key }}">{{ badge.label }}</span>{%- endif -%}
{%- endfor -%}
{%- endcapture -%}
{%- if gm_badges_out != '' -%}<span class="gm-badges">{{ gm_badges_out | raw }}</span>{%- endif -%}`;

export const GM_MARKS = `{%- assign gm_marks = item | footnote_marks: show.allergens, show.additives -%}
{%- if gm_marks != '' -%}<sup class="gm-marks">{{ gm_marks }}</sup>{%- endif -%}`;

export const GM_PRICE = `{%- if show.price and item.priceFormatted -%}<span class="gm-price">{{ item.priceFormatted }}</span>{%- endif -%}`;

export const GM_ALCOHOL = `{%- if show.alcohol and item.alcohol -%}
{%- assign gm_alc = item | alcohol_label -%}
{%- if gm_alc != '' -%}<span class="gm-alcohol gm-alcohol--{{ item.alcohol.category }}">{{ gm_alc }}</span>{%- endif -%}
{%- endif -%}`;

export const GM_ALLERGEN_ICONS = `{%- if show.allergens and fields.allergenDisplay != 'footnotes' -%}{{ item | allergen_marks }}{%- endif -%}`;

export const GM_TAGS = `{%- if show.flavors and item.tags.size > 0 -%}<span class="gm-tags">{%- for tag in item.tags -%}<span class="gm-tag"{% if tag.color %} style="--gm-tag-color: {{ tag.color }}"{% endif %}>{{ tag.label }}</span>{%- endfor -%}</span>{%- endif -%}`;

export const GM_INGREDIENTS = `{%- if show.amounts and item.amounts.size > 0 -%}
<p class="gm-ingredients">{%- for entry in item.amounts -%}{% if entry.amount %}{{ entry.amount }}{% if entry.unit %} {{ entry.unit }}{% endif %} {% endif %}{{ entry.name }}{% if entry.optional %} ({{ 'item.optional' | t }}){% endif %}{% unless forloop.last %}, {% endunless %}{%- endfor -%}</p>
{%- elsif show.ingredients and item.ingredients.size > 0 -%}
<p class="gm-ingredients">{%- for entry in item.ingredients -%}{{ entry.name }}{% if entry.optional %} ({{ 'item.optional' | t }}){% endif %}{% unless forloop.last %}, {% endunless %}{%- endfor -%}</p>
{%- endif -%}`;

/** Fields rendered behind a toggle in the list (`expandable` mode). */
export const GM_EXPANDABLES = `{%- if expand.any -%}
<details class="gm-expand">
<summary>{{ 'item.more' | t }}</summary>
<div class="gm-expand-body">
{%- if expand.description and item.description -%}<div class="gm-description">{{ item.description | markdown }}</div>{%- endif -%}
{%- if expand.ingredients and item.ingredients.size > 0 -%}<p class="gm-ingredients"><strong>{{ 'item.ingredients' | t }}:</strong> {{ item.ingredients | join_names }}</p>{%- endif -%}
{%- if expand.flavors and item.tags.size > 0 -%}<p class="gm-tags-text">{{ item.tags | join_names: ' · ' }}</p>{%- endif -%}
{%- if expand.history and item.history -%}<div class="gm-history">{{ item.history | markdown }}</div>{%- endif -%}
{%- if expand.glass and item.glass -%}<p class="gm-glass"><strong>{{ 'item.glass' | t }}:</strong> {{ item.glass.name }}</p>{%- endif -%}
{%- if expand.garnish and item.garnishes.size > 0 -%}<p class="gm-garnish"><strong>{{ 'item.garnish' | t }}:</strong> {{ item.garnishes | join_names }}</p>{%- endif -%}
{%- if expand.alcohol and item.alcohol -%}<p class="gm-alcohol-text"><strong>{{ 'item.alcohol' | t }}:</strong> {{ item | alcohol_label }}</p>{%- endif -%}
{%- if expand.allergens and item.allergens.size > 0 -%}<p class="gm-allergen-text"><strong>{{ 'item.allergens' | t }}:</strong> {{ item.allergens | join_names }}</p>{%- endif -%}
{%- if expand.additives and item.additives.size > 0 -%}<p class="gm-additive-text"><strong>{{ 'item.additives' | t }}:</strong> {% for additive in item.additives %}{{ additive.label }}{% unless forloop.last %}, {% endunless %}{% endfor %}</p>{%- endif -%}
</div>
</details>
{%- endif -%}`;

/** Default `item_detail` slot (web detail sheet); all non-`off` fields are shown. */
export const DEFAULT_ITEM_DETAIL = `<div class="gm-detail{% if item.unavailable %} is-unavailable{% endif %}">
{%- if show.image and item.imageUrl -%}<img class="gm-detail-image" src="{{ item.imageUrl }}" alt="{{ item.name }}" loading="lazy">{%- endif -%}
<div class="gm-detail-head">
<h2 class="gm-detail-name">{{ item.name }}</h2>
{%- include 'gm_price' -%}
</div>
{%- if item.nameOriginal != item.name -%}<p class="gm-detail-original">{{ item.nameOriginal }}</p>{%- endif -%}
{%- include 'gm_badges' -%}
{%- if show.description and item.description -%}<div class="gm-detail-description">{{ item.description | markdown }}</div>{%- endif -%}
{%- if show.flavors and item.tags.size > 0 -%}<div class="gm-detail-row">{%- include 'gm_tags' -%}</div>{%- endif -%}
{%- if show.amounts and item.amounts.size > 0 -%}
<h3 class="gm-detail-label">{{ 'item.amounts' | t }}</h3>
<ul class="gm-detail-list">{%- for entry in item.amounts -%}<li>{% if entry.amount %}<span class="gm-amount">{{ entry.amount }}{% if entry.unit %} {{ entry.unit }}{% endif %}</span> {% endif %}{{ entry.name }}{% if entry.optional %} <small>({{ 'item.optional' | t }})</small>{% endif %}</li>{%- endfor -%}</ul>
{%- elsif show.ingredients and item.ingredients.size > 0 -%}
<h3 class="gm-detail-label">{{ 'item.ingredients' | t }}</h3>
<ul class="gm-detail-list">{%- for entry in item.ingredients -%}<li>{{ entry.name }}{% if entry.optional %} <small>({{ 'item.optional' | t }})</small>{% endif %}</li>{%- endfor -%}</ul>
{%- endif -%}
{%- if show.glass and item.glass -%}<p class="gm-detail-row"><strong>{{ 'item.glass' | t }}:</strong> {{ item.glass.name }}</p>{%- endif -%}
{%- if show.garnish and item.garnishes.size > 0 -%}<p class="gm-detail-row"><strong>{{ 'item.garnish' | t }}:</strong> {{ item.garnishes | join_names }}</p>{%- endif -%}
{%- if show.alcohol and item.alcohol -%}{%- assign gm_alc = item | alcohol_label -%}{%- if gm_alc != '' -%}<p class="gm-detail-row"><strong>{{ 'item.alcohol' | t }}:</strong> {{ gm_alc }}</p>{%- endif -%}{%- endif -%}
{%- if show.rating and item.rating -%}<p class="gm-detail-row"><strong>{{ 'item.rating' | t }}:</strong> {{ 'item.ratingValue' | t: value: item.rating.average, count: item.rating.count }}</p>{%- endif -%}
{%- if show.allergens and item.allergens.size > 0 -%}
<h3 class="gm-detail-label">{{ 'item.allergens' | t }}</h3>
<p class="gm-detail-row">{{ item | allergen_marks }} {% for allergen in item.allergens %}{{ allergen.label }}{% if allergen.optional %} ({{ 'item.optional' | t }}){% endif %}{% unless forloop.last %}, {% endunless %}{% endfor %}</p>
{%- endif -%}
{%- if show.additives and item.additives.size > 0 -%}
<h3 class="gm-detail-label">{{ 'item.additives' | t }}</h3>
<p class="gm-detail-row">{% for additive in item.additives %}{{ additive.number }} {{ additive.label }}{% if additive.optional %} ({{ 'item.optional' | t }}){% endif %}{% unless forloop.last %}, {% endunless %}{% endfor %}</p>
{%- endif -%}
{%- if item.guestInfoComplete == false and show.allergens -%}<p class="gm-detail-hint">{{ 'item.incomplete' | t }}</p>{%- endif -%}
{%- if show.history and item.history -%}
<details class="gm-detail-history"><summary>{{ 'item.history' | t }}</summary>{{ item.history | markdown }}</details>
{%- endif -%}
</div>`;

export const DEFAULT_MENU_HEADER = `{%- if header -%}<header class="gm-header">
{%- if header.showLogo and theme.logoUrl -%}<img class="gm-logo" src="{{ theme.logoUrl }}" alt="{{ menu.workspaceName }}">{%- endif -%}
{%- if header.showTitle -%}<h1 class="gm-title">{{ menu.title | default: menu.workspaceName }}</h1>{%- endif -%}
{%- if header.showSubtitle and menu.subtitle -%}<p class="gm-subtitle">{{ menu.subtitle }}</p>{%- endif -%}
</header>{%- endif -%}`;

export const DEFAULT_SECTION_HEADER = `<header class="gm-section-head">
<h2 class="gm-section-title">{{ section.title }}</h2>
{%- if section.description -%}<div class="gm-section-description">{{ section.description | markdown }}</div>{%- endif -%}
</header>`;

export const DEFAULT_FOOTER = `<footer class="gm-footer">
{%- if footnotes.allergens.size > 0 -%}
<div class="gm-legend"><h4 class="gm-legend-title">{{ 'footer.allergens' | t }}</h4><ul class="gm-legend-list">{%- for allergen in footnotes.allergens -%}<li><b>{{ allergen.short }}</b> {{ allergen.label }}</li>{%- endfor -%}</ul></div>
{%- endif -%}
{%- if footnotes.additives.size > 0 -%}
<div class="gm-legend"><h4 class="gm-legend-title">{{ 'footer.additives' | t }}</h4><ul class="gm-legend-list">{%- for additive in footnotes.additives -%}<li><b>{{ additive.number }}</b> {{ additive.label }}</li>{%- endfor -%}</ul></div>
{%- endif -%}
{%- for notice in notices -%}<div class="gm-footer-notice">{{ notice.markdown | markdown }}</div>{%- endfor -%}
</footer>`;

export const GUEST_MENU_PARTIALS: Record<string, string> = {
  gm_badges: GM_BADGES,
  gm_marks: GM_MARKS,
  gm_price: GM_PRICE,
  gm_alcohol: GM_ALCOHOL,
  gm_allergen_icons: GM_ALLERGEN_ICONS,
  gm_tags: GM_TAGS,
  gm_ingredients: GM_INGREDIENTS,
  gm_expandables: GM_EXPANDABLES,
  gm_item_detail: DEFAULT_ITEM_DETAIL,
};
