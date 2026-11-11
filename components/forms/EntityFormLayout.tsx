import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@components/ui';

export interface FormNavSection {
  /** Id of the element to jump to. */
  id: string;
  label: string;
  /** Hide the entry when the side column is visible anyway (it targets the side column). */
  hideWhenWide?: boolean;
}

interface EntityFormLayoutProps {
  /** The form's {@link FormSection}s. */
  children: React.ReactNode;
  /** Side column (preview, summaries); next to the sections in wide containers, below them otherwise. */
  aside?: React.ReactNode;
  /** Keep the side column in view while scrolling (page mode, wide containers). */
  stickyAside?: boolean;
  /** Sections after the side column in narrow containers, below the main sections in wide ones (e.g. "More actions"). */
  trailing?: React.ReactNode;
  /** Jump navigation for long forms (page mode only). */
  sections?: FormNavSection[];
  /** Rendered inside a modal: no sticky navigation, no page scroll offsets. */
  embedded?: boolean;
  /** Use the full page width (editors with their own preview, e.g. the card editor). */
  fullWidth?: boolean;
}

/**
 * Frame of every entity form (page and modal). Layout decisions follow the width of the form's
 * container (container queries), not the viewport – so the same form works on an iPad in portrait
 * (one column), in landscape (sections + side column), in Split View and inside a modal.
 * The save button lives in the header (see FormSaveButton), not in an extra bar.
 */
export function EntityFormLayout({ children, aside, stickyAside = false, trailing, sections, embedded = false, fullWidth = false }: EntityFormLayoutProps) {
  const hasSectionNav = sections != null && sections.length > 1 && !embedded;

  // Keep focused fields / jump targets clear of the sticky header (+ section navigation).
  useEffect(() => {
    if (embedded) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = `calc(var(--manage-header-h, 0px) + ${hasSectionNav ? '4rem' : '1rem'})`;
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, [embedded, hasSectionNav]);

  const column = 'flex min-w-0 flex-col gap-4 md:gap-6';

  return (
    <div className="@container flex w-full flex-col">
      {hasSectionNav ? <FormSectionNav sections={sections} /> : null}
      <div
        className={cn(
          'mx-auto grid w-full gap-4 md:gap-6',
          aside != null ? 'max-w-6xl @4xl:grid-cols-[minmax(0,1fr)_20rem] @5xl:grid-cols-[minmax(0,1fr)_24rem]' : fullWidth ? undefined : 'max-w-3xl',
        )}
      >
        <div className={cn(column, '@4xl:col-start-1')}>{children}</div>
        {aside != null ? (
          <aside
            className={cn(
              column,
              '@4xl:col-start-2 @4xl:row-start-1',
              trailing != null && '@4xl:row-span-2',
              stickyAside &&
                !embedded &&
                (hasSectionNav
                  ? '@4xl:sticky @4xl:top-[calc(var(--manage-header-h,0px)+4rem)] @4xl:max-h-[calc(100dvh-var(--manage-header-h,0px)-5rem)] @4xl:self-start'
                  : '@4xl:sticky @4xl:top-[calc(var(--manage-header-h,0px)+1rem)] @4xl:max-h-[calc(100dvh-var(--manage-header-h,0px)-2rem)] @4xl:self-start'),
            )}
          >
            {aside}
          </aside>
        ) : null}
        {trailing != null ? <div className={cn(column, '@4xl:col-start-1')}>{trailing}</div> : null}
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Sticky, horizontally scrollable jump bar below the page header (same tab style as the settings navigation). */
function FormSectionNav({ sections }: { sections: FormNavSection[] }) {
  const { t } = useTranslation(['common']);
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const sectionKey = sections.map((section) => section.id).join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const order = sectionKey.split('|');
    const elements = order.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => element != null);
    // Active = the first section (in navigation order, i.e. main column before side column) that crosses
    // the upper third of the viewport. The observer only reports changes, so visibility is tracked here.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id)));
        const first = order.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sectionKey]);

  return (
    <nav
      aria-label={t('common:form.sectionNav')}
      className="sticky top-[var(--manage-header-h,0px)] z-10 -mx-4 -mt-4 mb-4 border-b border-base-300 bg-base-100/95 backdrop-blur md:-mx-5 md:-mt-5 md:mb-6 print:hidden"
    >
      <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 md:px-5">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id} className={cn('shrink-0', section.hideWhenWide && '@4xl:hidden')}>
              <a
                href={`#${section.id}`}
                aria-current={active ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveId(section.id);
                  document.getElementById(section.id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
                }}
                className={cn(
                  '-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  active ? 'border-primary text-base-content' : 'border-transparent text-base-content/60 hover:text-base-content',
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
