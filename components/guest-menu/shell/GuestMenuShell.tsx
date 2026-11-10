/**
 * Guest menu shell: fixed React chrome (language, search, filters, section
 * navigation, detail sheet) around the sanitized Liquid slots from
 * `renderMenuSlots`. Used by the public page `/m/[...slug]` and the builder preview.
 *
 * Styling only via theme variables (`--gm-*`, set by `rendered.css`); no cookies;
 * search/filter state optionally mirrored to the URL (`q`, `tags`, `alc`, `without`, `max`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { GuestMenuOutput, PublicMenuDto } from '@lib/guest-menu/schema';
import type { RenderedItem, RenderedMenu } from '@lib/guest-menu/render';
import {
  buildSearchEntries,
  EMPTY_FILTERS,
  hasActiveFilters,
  searchEntries,
  serializeShellUrlState,
  visibleTagCategories,
  countAlcohol,
  countCustom,
  countTag,
  type SearchResult,
  type ShellFilters,
  type ShellUrlState,
} from '@lib/guest-menu/search';
import { FilterChip, FilterSheet, toggle, type FilterFacets } from './FilterSheet';
import { Sheet } from './Sheet';
import { CloseIcon, FilterIcon, SearchIcon } from './icons';
import { SHELL_CSS } from './shellStyles';
import { useGuestText, type GuestText } from './useGuestText';
import './fonts';

export interface GuestMenuShellProps {
  dto: PublicMenuDto;
  rendered: RenderedMenu;
  /** Defaults to `dto.output`. Monitor/print render statically. */
  output?: GuestMenuOutput;
  /** Search, filters, navigation and detail sheet (default: true for web). */
  interactive?: boolean;
  /** Called with a content locale from `dto.availableLocales`; the switcher is hidden without it. */
  onLocaleChange?: (locale: string) => void;
  /** Initial search/filter state (e.g. parsed from the URL on the server). */
  initialState?: Partial<ShellUrlState>;
  /** Mirror search/filter state into `window.location.search` (default false). */
  syncUrl?: boolean;
  /** Render overlays `position: absolute` inside the shell (builder preview) instead of fixed. */
  contained?: boolean;
  /** Rendered between menu header and the sticky bar (e.g. schedule notices). */
  banner?: ReactNode;
  className?: string;
}

/** Minimum number of drinks to offer filters; below only search is shown. */
export const MIN_ITEMS_FOR_FILTERS = 10;

function styleHtml(css: string) {
  return { __html: css.replace(/<\/style/gi, '<\\/style') };
}

function useScrollSpy(rootRef: React.RefObject<HTMLElement | null>, enabled: boolean, deps: unknown[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || typeof IntersectionObserver === 'undefined') return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-section-id]'));
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          const id = (record.target as HTMLElement).dataset.sectionId!;
          if (record.isIntersecting) visible.set(id, record.boundingClientRect.top);
          else visible.delete(id);
        }
        const first = sections.find((section) => visible.has(section.dataset.sectionId!));
        if (first) setActive(first.dataset.sectionId!);
      },
      { rootMargin: '-140px 0px -55% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rootRef, ...deps]);
  return active;
}

function ItemWrap({ item, interactive, reason, onOpen }: { item: RenderedItem; interactive: boolean; reason?: string | null; onOpen: (id: string) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(item.id);
    }
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a, summary, details, button, input, select')) return;
    onOpen(item.id);
  };
  const canOpen = interactive && item.detailHtml !== '';
  return (
    <div
      className="gm-item-wrap"
      data-item-id={item.id}
      data-interactive={canOpen ? 'true' : undefined}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-haspopup={canOpen ? 'dialog' : undefined}
      onClick={canOpen ? onClick : undefined}
      onKeyDown={canOpen ? onKeyDown : undefined}
    >
      <div className="gm-item-slot" dangerouslySetInnerHTML={{ __html: item.html }} />
      {reason && <p className="gm-shell-reason">{reason}</p>}
    </div>
  );
}

function reasonText(result: SearchResult, t: GuestText): string | null {
  if (!result.reason || result.reason.kind === 'name') return null;
  switch (result.reason.kind) {
    case 'originalName':
      return `${t('shell.matchOriginalName')}: ${result.reason.value}`;
    case 'ingredient':
      return t('shell.matchIngredient', { value: result.reason.value });
    case 'tag':
      return t('shell.matchTag', { value: result.reason.value });
  }
}

export function GuestMenuShell({
  dto,
  rendered,
  output,
  interactive: interactiveProp,
  onLocaleChange,
  initialState,
  syncUrl = false,
  contained = false,
  banner,
  className,
}: GuestMenuShellProps) {
  const t = useGuestText(dto);
  const effectiveOutput = output ?? dto.output;
  const interactive = interactiveProp ?? effectiveOutput === 'web';
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(initialState?.query ?? '');
  const [filters, setFilters] = useState<ShellFilters>({ ...EMPTY_FILTERS, ...initialState?.filters });
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const entries = useMemo(() => buildSearchEntries(dto), [dto]);
  const renderedItems = useMemo(() => {
    const map = new Map<string, RenderedItem>();
    rendered.sections.forEach((section) => section.items.forEach((item) => map.set(item.id, item)));
    rendered.onRequestItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [rendered]);
  const sectionTitles = useMemo(
    () => new Map(dto.blocks.flatMap((block) => (block.type === 'section' ? [[block.id, block.title] as const] : []))),
    [dto.blocks],
  );

  const searchEnabled = interactive && dto.search?.enabled !== false;
  // Self-defined filters were chosen deliberately, so they are offered even on small menus.
  const filtersEnabled = interactive && (entries.menu.length >= MIN_ITEMS_FOR_FILTERS || (dto.filters.custom?.length ?? 0) > 0);

  const facets: FilterFacets = useMemo(() => {
    const prices = entries.menu.map((entry) => entry.item.facets?.price).filter((price): price is number => price != null);
    const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;
    return {
      custom: dto.filters.custom ?? [],
      customTitle: dto.filters.customTitle ?? null,
      categories: visibleTagCategories(dto.filters.tagCategories),
      alcohol: dto.filters.alcoholCategories,
      allergens: dto.filters.allergens,
      price: new Set(prices).size >= 2 && max > min ? { min, max } : null,
    };
  }, [dto.filters, entries.menu]);
  const hasFacets =
    facets.custom.length > 0 || facets.categories.length > 0 || facets.alcohol.length >= 2 || facets.allergens.length > 0 || facets.price != null;

  const active = query.trim() !== '' || hasActiveFilters(filters);
  const results = useMemo(
    () => (active ? searchEntries(entries.menu, query, filters, dto.filters.tagCategories) : []),
    [active, entries.menu, query, filters, dto.filters.tagCategories],
  );
  const onRequestResults = useMemo(
    () => (query.trim() !== '' ? searchEntries(entries.onRequest, query, filters, dto.filters.tagCategories) : []),
    [entries.onRequest, query, filters, dto.filters.tagCategories],
  );
  const resultCount = useMemo(
    () => searchEntries(entries.menu, query, filters, dto.filters.tagCategories).length,
    [entries.menu, query, filters, dto.filters.tagCategories],
  );

  // URL sync (replaceState – no navigation, no history spam).
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    const search = serializeShellUrlState(window.location.search, { query, filters });
    if (search !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  }, [syncUrl, query, filters]);

  const sectionIds = useMemo(() => rendered.sections.map((section) => section.id), [rendered.sections]);
  const activeSection = useScrollSpy(rootRef, interactive && !active, [sectionIds.join('|'), active]);

  useEffect(() => {
    if (!activeSection || !navRef.current) return;
    const chip = navRef.current.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(activeSection)}"]`);
    if (chip) navRef.current.scrollTo({ left: chip.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeSection, reduceMotion]);

  const scrollToSection = useCallback(
    (id: string) => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);
      target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [reduceMotion],
  );

  // Quick chips: custom filters marked as quick; otherwise alcohol-free + the first filter category.
  const quickCustom = facets.custom.filter((filter) => filter.quick);
  const quickCategory = quickCustom.length > 0 ? undefined : facets.categories[0];
  const quickChips = filtersEnabled ? (
    <>
      {quickCustom.map((filter) => (
        <FilterChip
          key={`custom-${filter.id}`}
          label={filter.label}
          count={countCustom(entries.menu, filters, dto.filters.tagCategories, filter.id)}
          pressed={filters.custom.includes(filter.id)}
          onToggle={() => setFilters({ ...filters, custom: toggle(filters.custom, filter.id) })}
        />
      ))}
      {quickCustom.length === 0 && facets.alcohol.includes('alcoholFree') && facets.alcohol.length >= 2 && (
        <FilterChip
          label={t('guestInfo:alcohol.category.alcoholFree')}
          count={countAlcohol(entries.menu, filters, dto.filters.tagCategories, 'alcoholFree')}
          pressed={filters.alcohol.includes('alcoholFree')}
          onToggle={() => setFilters({ ...filters, alcohol: toggle(filters.alcohol, 'alcoholFree') })}
        />
      )}
      {quickCategory?.tags.slice(0, 8).map((tag) => (
        <FilterChip
          key={tag.tag}
          label={tag.label}
          count={countTag(entries.menu, filters, dto.filters.tagCategories, quickCategory.id, tag.tag)}
          pressed={filters.tags.includes(tag.tag)}
          onToggle={() => setFilters({ ...filters, tags: toggle(filters.tags, tag.tag) })}
        />
      ))}
    </>
  ) : null;
  const activeFilterCount = filters.tags.length + filters.alcohol.length + filters.without.length + filters.custom.length + (filters.maxPrice != null ? 1 : 0);

  const languageNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([dto.uiLocale], { type: 'language' });
    } catch {
      return null;
    }
  }, [dto.uiLocale]);
  const showLanguage = !!onLocaleChange && dto.availableLocales.length > 1;

  const detailItem = detailId ? renderedItems.get(detailId) : undefined;
  const detailName = detailId
    ? ([...entries.menu, ...entries.onRequest].find((entry) => entry.item.id === detailId)?.item.name ?? t('item.details'))
    : t('item.details');
  const openDetail = useCallback((id: string) => setDetailId(id), []);

  const sectionById = useMemo(() => new Map(rendered.sections.map((section) => [section.id, section])), [rendered.sections]);
  const showBar = interactive && (searchEnabled || showLanguage || sectionIds.length > 1);
  // `class` is applied via className below.
  const { class: _rootClass, ...rootAttributes } = rendered.rootAttributes;
  void _rootClass;

  const renderResults = (list: SearchResult[]) => (
    <div className="gm-items" data-layout={dto.layout}>
      {list.map((result) => {
        const item = renderedItems.get(result.entry.item.id);
        return item ? <ItemWrap key={item.id} item={item} interactive={interactive} reason={reasonText(result, t)} onOpen={openDetail} /> : null;
      })}
    </div>
  );

  return (
    <div
      ref={rootRef}
      {...rootAttributes}
      className={['gm-root', 'gm-shell', className].filter(Boolean).join(' ')}
      data-contained={contained ? 'true' : undefined}
      data-interactive={interactive ? 'true' : undefined}
    >
      <style dangerouslySetInnerHTML={styleHtml(rendered.css)} />
      <style dangerouslySetInnerHTML={styleHtml(SHELL_CSS)} />
      {dto.menu.isPreview && <div className="gm-shell-banner">{t('page.previewBanner')}</div>}
      {rendered.menuHeader && (
        <div
          className="gm-menu-header"
          data-block-id={rendered.blocks.find((block) => block.type === 'header')?.id}
          dangerouslySetInnerHTML={{ __html: rendered.menuHeader }}
        />
      )}
      {banner}

      {showBar && (
        <div className="gm-shell-bar">
          <div className="gm-shell-row">
            {searchEnabled && (
              <div className="gm-shell-search" role="search">
                <span className="gm-shell-search-icon">
                  <SearchIcon />
                </span>
                <label className="gm-shell-sr" htmlFor={`gm-search-${dto.menu.id}`}>
                  {t('shell.search')}
                </label>
                <input
                  id={`gm-search-${dto.menu.id}`}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={query}
                  placeholder={t('shell.searchPlaceholder')}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query !== '' && (
                  <button type="button" className="gm-shell-icon-btn" onClick={() => setQuery('')} aria-label={t('shell.clearSearch')}>
                    <CloseIcon />
                  </button>
                )}
              </div>
            )}
            {filtersEnabled && hasFacets && (
              <button type="button" className="gm-shell-btn" aria-pressed={activeFilterCount > 0} onClick={() => setFilterOpen(true)} aria-haspopup="dialog">
                <FilterIcon />
                <span>{t('shell.filters')}</span>
                {activeFilterCount > 0 && <span className="gm-shell-badge">{activeFilterCount}</span>}
              </button>
            )}
            {showLanguage && (
              <label className="gm-shell-lang">
                <span className="gm-shell-sr">{t('shell.language')}</span>
                <select value={dto.locale} onChange={(event) => onLocaleChange?.(event.target.value)}>
                  {dto.availableLocales.map((locale) => (
                    <option key={locale} value={locale}>
                      {languageNames?.of(locale) ?? locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {quickChips && <div className="gm-shell-chips">{quickChips}</div>}
          {!active && sectionIds.length > 1 && (
            <nav className="gm-shell-chips gm-shell-nav" ref={navRef} aria-label={t('shell.sections')}>
              {sectionIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="gm-shell-chip"
                  data-nav-id={id}
                  aria-current={activeSection === id ? 'true' : undefined}
                  onClick={() => scrollToSection(id)}
                >
                  {sectionTitles.get(id)}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      <main className="gm-shell-main">
        {active ? (
          <div className="gm-shell-results" aria-live="polite">
            <p className="gm-shell-meta">{t('shell.results', { count: results.length })}</p>
            {results.length > 0 ? (
              renderResults(results)
            ) : (
              <div className="gm-shell-empty">
                <p>{t('shell.noResults')}</p>
                <p>{t('shell.noResultsHint')}</p>
              </div>
            )}
            {onRequestResults.length > 0 && (
              <>
                <h2 className="gm-shell-results-title">{t('shell.onRequestResults')}</h2>
                {renderResults(onRequestResults)}
              </>
            )}
          </div>
        ) : (
          rendered.blocks.map((block) => {
            if (block.type === 'header') return null;
            if (block.type === 'section') {
              const section = sectionById.get(block.sectionId);
              if (!section) return null;
              return (
                <section key={section.id} className="gm-section" id={`gm-section-${section.id}`} data-section-id={section.id}>
                  <div className="gm-section-header" dangerouslySetInnerHTML={{ __html: section.header }} />
                  <div className="gm-items" data-layout={section.layout}>
                    {section.items.map((item) => (
                      <ItemWrap key={item.id} item={item} interactive={interactive} onOpen={openDetail} />
                    ))}
                  </div>
                </section>
              );
            }
            return (
              <div key={block.id} className={`gm-block gm-block--${block.type}`} data-block-id={block.id} dangerouslySetInnerHTML={{ __html: block.html }} />
            );
          })
        )}
      </main>
      <div className="gm-menu-footer" dangerouslySetInnerHTML={{ __html: rendered.footer }} />

      {interactive && (
        <>
          <Sheet open={!!detailItem} onClose={() => setDetailId(null)} title={detailName} closeLabel={t('shell.close')} hideTitle>
            {detailItem && <div className="gm-detail-body" dangerouslySetInnerHTML={{ __html: detailItem.detailHtml }} />}
          </Sheet>
          {filtersEnabled && (
            <FilterSheet
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              entries={entries.menu}
              facets={facets}
              filters={filters}
              onChange={setFilters}
              resultCount={resultCount}
              locale={dto.locale}
              currency={dto.currency}
              t={t}
            />
          )}
        </>
      )}
    </div>
  );
}
