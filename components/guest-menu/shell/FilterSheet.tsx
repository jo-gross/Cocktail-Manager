import type { AlcoholCategory, Allergen } from '@lib/guest-info/constants';
import type { PublicCustomFilterDto, PublicTagCategoryDto } from '@lib/guest-menu/schema';
import { countAlcohol, countCustom, countTag, countWithout, EMPTY_FILTERS, type SearchEntry, type ShellFilters } from '@lib/guest-menu/search';
import { formatMoney } from '@lib/guest-menu/format';
import { Sheet } from './Sheet';
import type { GuestText } from './useGuestText';

export interface FilterFacets {
  custom: PublicCustomFilterDto[];
  customTitle: string | null;
  categories: PublicTagCategoryDto[];
  alcohol: AlcoholCategory[];
  allergens: Allergen[];
  price: { min: number; max: number } | null;
}

interface ChipProps {
  label: string;
  count: number;
  pressed: boolean;
  onToggle: () => void;
}

export function FilterChip({ label, count, pressed, onToggle }: ChipProps) {
  return (
    <button type="button" className="gm-shell-chip" aria-pressed={pressed} disabled={!pressed && count === 0} onClick={onToggle}>
      {label}
      <span className="gm-shell-count">{count}</span>
    </button>
  );
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  entries: SearchEntry[];
  facets: FilterFacets;
  filters: ShellFilters;
  onChange: (filters: ShellFilters) => void;
  resultCount: number;
  locale: string;
  currency: string;
  t: GuestText;
  closeOnBack?: boolean;
}

export function FilterSheet({ open, onClose, entries, facets, filters, onChange, resultCount, locale, currency, t, closeOnBack }: FilterSheetProps) {
  const footer = (
    <>
      <button type="button" className="gm-shell-btn" onClick={() => onChange(EMPTY_FILTERS)}>
        {t('shell.resetFilters')}
      </button>
      <button type="button" className="gm-shell-btn gm-shell-btn--primary" onClick={onClose}>
        {t('shell.showResults', { count: resultCount })}
      </button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('shell.filtersTitle')} closeLabel={t('shell.close')} footer={footer} closeOnBack={closeOnBack}>
      {facets.custom.length > 0 && (
        <section className="gm-shell-group">
          <h3>{facets.customTitle || t('shell.customFilters')}</h3>
          <div className="gm-shell-wrap">
            {facets.custom.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                count={countCustom(entries, filters, facets.categories, filter.id)}
                pressed={filters.custom.includes(filter.id)}
                onToggle={() => onChange({ ...filters, custom: toggle(filters.custom, filter.id) })}
              />
            ))}
          </div>
        </section>
      )}
      {facets.categories.map((category) => (
        <section key={category.id} className="gm-shell-group">
          <h3>{category.name}</h3>
          <div className="gm-shell-wrap">
            {category.tags.map((tag) => (
              <FilterChip
                key={tag.tag}
                label={tag.label}
                count={countTag(entries, filters, facets.categories, category.id, tag.tag)}
                pressed={filters.tags.includes(tag.tag)}
                onToggle={() => onChange({ ...filters, tags: toggle(filters.tags, tag.tag) })}
              />
            ))}
          </div>
        </section>
      ))}
      {facets.alcohol.length >= 2 && (
        <section className="gm-shell-group">
          <h3>{t('shell.alcoholCategory')}</h3>
          <div className="gm-shell-wrap">
            {facets.alcohol.map((category) => (
              <FilterChip
                key={category}
                label={t(`guestInfo:alcohol.category.${category}`)}
                count={countAlcohol(entries, filters, facets.categories, category)}
                pressed={filters.alcohol.includes(category)}
                onToggle={() => onChange({ ...filters, alcohol: toggle(filters.alcohol, category) })}
              />
            ))}
          </div>
        </section>
      )}
      {facets.allergens.length > 0 && (
        <section className="gm-shell-group">
          <h3>{t('shell.without')}</h3>
          <p className="gm-shell-group-hint">{t('shell.withoutHint')}</p>
          <div className="gm-shell-wrap">
            {facets.allergens.map((allergen) => (
              <FilterChip
                key={allergen}
                label={t(`guestInfo:allergenWithout.${allergen}`)}
                count={countWithout(entries, filters, facets.categories, allergen)}
                pressed={filters.without.includes(allergen)}
                onToggle={() => onChange({ ...filters, without: toggle(filters.without, allergen) })}
              />
            ))}
          </div>
        </section>
      )}
      {facets.price && (
        <section className="gm-shell-group">
          <h3>{t('shell.price')}</h3>
          <label className="gm-shell-range">
            <span>{t('shell.priceUpTo', { price: formatMoney(filters.maxPrice ?? facets.price.max, locale, currency) })}</span>
            <input
              type="range"
              min={facets.price.min}
              max={facets.price.max}
              step={0.5}
              value={filters.maxPrice ?? facets.price.max}
              onChange={(event) => {
                const value = Number(event.target.value);
                onChange({ ...filters, maxPrice: value >= facets.price!.max ? null : value });
              }}
            />
          </label>
        </section>
      )}
    </Sheet>
  );
}
