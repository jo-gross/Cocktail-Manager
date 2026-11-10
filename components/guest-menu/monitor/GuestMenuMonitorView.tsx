/**
 * Static monitor rendering of a guest menu (signage `GUEST_MENU` slides and the
 * builder's monitor preview).
 *
 * The menu is laid out on a virtual canvas (1920×1080 / 1080×1920) that is
 * scaled with a CSS transform to fill the parent (letterboxed). Auto-fit:
 * every unit (section header, item, block) is measured in a hidden column for
 * each font scale / column count candidate, paginated with
 * `paginateMonitorUnits` and the best layout is picked (fewest pages, then the
 * largest font, then the fewest columns). Font scaling is a second transform on
 * the stage, so `rem`-based template CSS scales as well.
 *
 * Pure: no fetching, no timers – the caller drives `pageIndex`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import type { PublicMenuDto } from '@lib/guest-menu/schema';
import type { RenderedMenu, RenderedSection } from '@lib/guest-menu/render';
import {
  autoColumnCandidates,
  balanceSinglePage,
  chooseBestFit,
  MONITOR_FONT_SCALES,
  paginateMonitorUnits,
  type FitCandidate,
  type MonitorFragment,
  type MonitorPage,
  type MonitorUnit,
} from '@lib/guest-menu/monitor/paginate';
import '../shell/fonts';

export type GuestMenuMonitorFormat = 'LANDSCAPE' | 'PORTRAIT';

export interface GuestMenuMonitorViewProps {
  dto: PublicMenuDto;
  rendered: RenderedMenu;
  format: GuestMenuMonitorFormat;
  /** Page to show (wraps around); default 0. */
  pageIndex?: number;
  /** Called whenever the computed page count changes. */
  onPageCount?: (count: number) => void;
  /** Default: `dto.monitor.columns` (or `auto`). */
  columns?: 'auto' | number;
  /** Default: `dto.monitor.showQrCode`. */
  showQrCode?: boolean;
  /** QR target; default: absolute URL of `dto.menu.publicPath`. */
  qrUrl?: string;
  className?: string;
}

export const MONITOR_VIRTUAL_SIZE: Record<GuestMenuMonitorFormat, { width: number; height: number }> = {
  LANDSCAPE: { width: 1920, height: 1080 },
  PORTRAIT: { width: 1080, height: 1920 },
};

const STAGE_PADDING = 48;
const COLUMN_GAP = 40;
/** QR code size/margin in virtual canvas px (not affected by the font scale). */
const QR_SIZE = 180;
const QR_MARGIN = 24;
const FOOTER_ID = '__footer';

const MONITOR_CSS = `
.gm-monitor-stage { box-sizing: border-box; overflow: hidden; display: flex; align-items: flex-start; }
.gm-monitor-stage .gm-items { grid-template-columns: minmax(0, 1fr) !important; }
.gm-monitor-stage .gm-section { scroll-margin-top: 0; }
.gm-monitor-stage .gm-section[data-continued="true"]:not([data-show-header="true"]) { padding-top: 0; }
.gm-root.gm-monitor-stage .is-unavailable { opacity: 0.4; filter: grayscale(1); }
.gm-monitor-column { flex: none; min-width: 0; }
.gm-monitor-page { animation: gm-monitor-fade 600ms ease-out; }
@keyframes gm-monitor-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .gm-monitor-page { animation: none; } }
`;

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function styleHtml(css: string) {
  return { __html: css.replace(/<\/style/gi, '<\\/style') };
}

interface FitResult extends FitCandidate {
  columnWidth: number;
}

function rootProps(rendered: RenderedMenu) {
  const { class: className, ...rest } = rendered.rootAttributes;
  return { className: [className || 'gm-root', 'gm-monitor-stage'].join(' '), ...rest };
}

/** Reads unit heights from the measure column (distance from a unit's top to the next unit's top). */
function readUnits(column: HTMLElement, columnWidth: number): MonitorUnit[] {
  const columnRect = column.getBoundingClientRect();
  const factor = columnRect.width > 0 && columnWidth > 0 ? columnRect.width / columnWidth : 1;
  const elements = Array.from(column.querySelectorAll<HTMLElement>('[data-unit]'));
  const tops = elements.map((element) => element.getBoundingClientRect().top);
  return elements.map((element, index): MonitorUnit => {
    const end = index + 1 < tops.length ? tops[index + 1] : columnRect.bottom;
    const height = Math.max(0, (end - tops[index]) / factor);
    const kind = element.dataset.unit;
    if (kind === 'sectionHeader') return { kind: 'sectionHeader', sectionId: element.dataset.section!, height };
    if (kind === 'item') return { kind: 'item', sectionId: element.dataset.section!, itemId: element.dataset.id!, height };
    return { kind: 'block', blockId: element.dataset.id!, height };
  });
}

function SectionFragment({ section, fragment }: { section: RenderedSection; fragment: Extract<MonitorFragment, { kind: 'section' }> }) {
  const items = new Map(section.items.map((item) => [item.id, item]));
  return (
    <section
      className="gm-section"
      data-section-id={section.id}
      data-continued={fragment.continued ? 'true' : undefined}
      data-show-header={fragment.showHeader ? 'true' : undefined}
    >
      {fragment.showHeader && <div className="gm-section-header" dangerouslySetInnerHTML={{ __html: section.header }} />}
      <div className="gm-items" data-layout={section.layout}>
        {fragment.itemIds.map((id) => {
          const item = items.get(id);
          return item ? <div key={id} className="gm-item-wrap" data-item-id={id} dangerouslySetInnerHTML={{ __html: item.html }} /> : null;
        })}
      </div>
    </section>
  );
}

export function GuestMenuMonitorView({ dto, rendered, format, pageIndex = 0, onPageCount, columns, showQrCode, qrUrl, className }: GuestMenuMonitorViewProps) {
  const { width, height } = MONITOR_VIRTUAL_SIZE[format];
  const columnsSetting = columns ?? dto.monitor?.columns ?? 'auto';
  const qrEnabled = showQrCode ?? dto.monitor?.showQrCode ?? false;

  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRootRef = useRef<HTMLDivElement>(null);
  const measureColumnRef = useRef<HTMLDivElement>(null);
  const [viewportScale, setViewportScale] = useState(0);
  const [fit, setFit] = useState<FitResult | null>(null);
  const [measureTick, setMeasureTick] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const remeasure = useCallback(() => setMeasureTick((tick) => tick + 1), []);

  const sectionById = useMemo(() => new Map(rendered.sections.map((section) => [section.id, section])), [rendered.sections]);
  const blockById = useMemo(() => new Map(rendered.blocks.map((block) => [block.id, block])), [rendered.blocks]);
  const stageProps = rootProps(rendered);

  // Scale the virtual canvas to the parent.
  useIsomorphicLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      // offsetWidth ignores ancestor transforms (builder preview zoom).
      const w = viewport.offsetWidth || rect.width;
      const h = viewport.offsetHeight || rect.height;
      setViewportScale(w > 0 && h > 0 ? Math.min(w / width, h / height) : 0);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [width, height]);

  // Fonts and images change the measured heights.
  useEffect(() => {
    // ownerDocument: the builder preview renders into an iframe document.
    const fonts = measureRootRef.current?.ownerDocument.fonts ?? (typeof document !== 'undefined' ? document.fonts : undefined);
    let cancelled = false;
    fonts?.ready.then(() => !cancelled && remeasure());
    fonts?.addEventListener('loadingdone', remeasure);
    const root = measureRootRef.current;
    root?.addEventListener('load', remeasure, true);
    return () => {
      cancelled = true;
      fonts?.removeEventListener('loadingdone', remeasure);
      root?.removeEventListener('load', remeasure, true);
    };
  }, [remeasure]);

  useIsomorphicLayoutEffect(() => {
    const root = measureRootRef.current;
    const column = measureColumnRef.current;
    if (!root || !column) return;

    const candidates: FitResult[] = [];
    const columnOptions = columnsSetting === 'auto' ? autoColumnCandidates(format) : [columnsSetting];
    let best: FitResult | null = null;
    outer: for (const scale of MONITOR_FONT_SCALES) {
      const stageWidth = width / scale;
      const pageHeight = height / scale - 2 * STAGE_PADDING;
      const reserve = qrEnabled ? (QR_SIZE + QR_MARGIN) / scale : 0;
      root.style.width = `${stageWidth}px`;
      for (const columnCount of columnOptions) {
        const columnWidth = (stageWidth - 2 * STAGE_PADDING - (columnCount - 1) * COLUMN_GAP) / columnCount;
        column.style.width = `${columnWidth}px`;
        const units = readUnits(column, columnWidth);
        const input = { units, pageHeight, columns: columnCount, lastColumnReserve: reserve };
        const pages = paginateMonitorUnits(input);
        const candidate: FitResult = { scale, columns: columnCount, pages: pages.length === 1 ? balanceSinglePage(input).pages : pages, columnWidth };
        candidates.push(candidate);
        // Scales are descending and column counts ascending: the first single-page fit is optimal.
        if (pages.length === 1) {
          best = candidate;
          break outer;
        }
      }
    }
    setFit(best ?? (chooseBestFit(candidates) as FitResult | null));
  }, [rendered, format, width, height, columnsSetting, qrEnabled, measureTick]);

  const pageCount = fit?.pages.length ?? 0;
  useEffect(() => {
    if (pageCount > 0) onPageCount?.(pageCount);
  }, [pageCount, onPageCount]);

  useEffect(() => {
    if (!qrEnabled) return;
    const target = qrUrl ?? `${window.location.origin}${dto.menu.publicPath}`;
    let cancelled = false;
    QRCode.toDataURL(target, { margin: 1, width: QR_SIZE * 2, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setQrDataUrl(url))
      .catch(() => !cancelled && setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [qrEnabled, qrUrl, dto.menu.publicPath]);

  const page: MonitorPage | null = fit && fit.pages.length > 0 ? fit.pages[((pageIndex % fit.pages.length) + fit.pages.length) % fit.pages.length] : null;

  const renderFragment = (fragment: MonitorFragment, key: string): ReactNode => {
    if (fragment.kind === 'section') {
      const section = sectionById.get(fragment.sectionId);
      return section ? <SectionFragment key={key} section={section} fragment={fragment} /> : null;
    }
    if (fragment.blockId === FOOTER_ID) return <div key={key} className="gm-menu-footer" dangerouslySetInnerHTML={{ __html: rendered.footer }} />;
    const block = blockById.get(fragment.blockId);
    if (!block || block.type === 'section') return null;
    if (block.type === 'header') return <div key={key} className="gm-menu-header" dangerouslySetInnerHTML={{ __html: block.html }} />;
    return <div key={key} className={`gm-block gm-block--${block.type}`} dangerouslySetInnerHTML={{ __html: block.html }} />;
  };

  return (
    <div
      ref={viewportRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: dto.theme.cssVariables['--gm-bg'] }}
      data-gm-monitor={format}
    >
      <style dangerouslySetInnerHTML={styleHtml(rendered.css)} />
      <style dangerouslySetInnerHTML={styleHtml(MONITOR_CSS)} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width,
          height,
          transform: `translate(-50%, -50%) scale(${viewportScale})`,
          containerType: 'inline-size',
          overflow: 'hidden',
          visibility: viewportScale > 0 ? 'visible' : 'hidden',
        }}
      >
        {fit && page && (
          <div
            key={`${pageIndex % fit.pages.length}-${dto.locale}`}
            {...stageProps}
            className={`${stageProps.className} gm-monitor-page`}
            style={{
              width: width / fit.scale,
              height: height / fit.scale,
              padding: STAGE_PADDING,
              gap: COLUMN_GAP,
              transform: `scale(${fit.scale})`,
              transformOrigin: '0 0',
            }}
          >
            {page.columns.map((fragments, columnIndex) => (
              <div key={columnIndex} className="gm-monitor-column" style={{ width: fit.columnWidth }}>
                {fragments.map((fragment, index) => renderFragment(fragment, `${columnIndex}-${index}`))}
              </div>
            ))}
          </div>
        )}
        {qrEnabled && qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt=""
            style={{
              position: 'absolute',
              right: QR_MARGIN,
              bottom: QR_MARGIN,
              width: QR_SIZE,
              height: QR_SIZE,
              padding: 10,
              boxSizing: 'border-box',
              background: '#fff',
              borderRadius: 12,
            }}
          />
        )}

        {/* Hidden measurement layer: all units in one column. */}
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'visible' }}>
          <div ref={measureRootRef} {...stageProps} style={{ width, padding: `0 ${STAGE_PADDING}px` }}>
            <div ref={measureColumnRef} className="gm-monitor-column">
              {rendered.blocks.map((block) => {
                if (block.type === 'section') {
                  const section = sectionById.get(block.sectionId);
                  if (!section) return null;
                  return (
                    <section key={block.id} className="gm-section" data-unit="sectionHeader" data-section={section.id} data-show-header="true">
                      <div className="gm-section-header" dangerouslySetInnerHTML={{ __html: section.header }} />
                      <div className="gm-items" data-layout={section.layout}>
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="gm-item-wrap"
                            data-unit="item"
                            data-section={section.id}
                            data-id={item.id}
                            dangerouslySetInnerHTML={{ __html: item.html }}
                          />
                        ))}
                      </div>
                    </section>
                  );
                }
                if (block.type === 'header') {
                  return (
                    <div key={block.id} className="gm-menu-header" data-unit="block" data-id={block.id} dangerouslySetInnerHTML={{ __html: block.html }} />
                  );
                }
                return (
                  <div
                    key={block.id}
                    className={`gm-block gm-block--${block.type}`}
                    data-unit="block"
                    data-id={block.id}
                    dangerouslySetInnerHTML={{ __html: block.html }}
                  />
                );
              })}
              {rendered.footer.trim() && (
                <div className="gm-menu-footer" data-unit="block" data-id={FOOTER_ID} dangerouslySetInnerHTML={{ __html: rendered.footer }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
