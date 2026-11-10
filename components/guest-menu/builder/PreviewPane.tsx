/**
 * Center pane: server-rendered draft preview (GET /preview) in a device frame
 * (web), the paginated monitor view (1920×1080 / 1080×1920) or paper pages
 * (print). In select mode, clicking an item/section/block selects it.
 * All modes render inside a sandboxed iframe (IsolatedPreviewFrame): template
 * and custom CSS never touch the app document.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight, FaMousePointer } from 'react-icons/fa';
import { Alert, Button, Spinner } from '@components/ui';
import { GuestMenuShell } from '@components/guest-menu/shell';
import { GuestMenuMonitorView } from '@components/guest-menu/monitor/GuestMenuMonitorView';
import { sectionIdToBlockId } from '@lib/guest-menu/builder';
import type { PrintPaper } from '@lib/guest-menu/schema';
import { previewModeToOutput, useBuilder, type PreviewDevice } from './BuilderContext';
import { IsolatedPreviewFrame } from '@components/guest-menu/IsolatedPreviewFrame';

const DEVICE_SIZES: Record<Exclude<PreviewDevice, 'desktop'>, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
};

/** CSS px at 96 dpi. */
const PAPER_SIZES: Record<PrintPaper, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A5: { width: 559, height: 794 },
  DL: { width: 374, height: 794 },
};

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Scales fixed-size content down to the available width. */
function ScaledFrame({
  width,
  height,
  available,
  children,
  className,
}: {
  width: number;
  height: number;
  available: number;
  children: ReactNode;
  className?: string;
}) {
  const scale = available > 0 ? Math.min(1, available / width) : 1;
  return (
    <div style={{ width: width * scale, height: height * scale }} className="mx-auto shrink-0">
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }} className={className}>
        {children}
      </div>
    </div>
  );
}

function escapeAttr(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

export function PreviewPane({ device, loading, error }: { device: PreviewDevice; loading: boolean; error: string | null }) {
  const { t } = useTranslation('guestMenu');
  const { preview, previewMode, select, selection, document } = useBuilder();
  const [selectMode, setSelectMode] = useState(true);
  const [staticHtml, setStaticHtml] = useState('');
  const [monitorPage, setMonitorPage] = useState(0);
  const [monitorPageCount, setMonitorPageCount] = useState(0);
  const [containerRef, available] = useElementWidth<HTMLDivElement>();
  const output = previewModeToOutput(previewMode);

  useEffect(() => {
    if (monitorPageCount > 0 && monitorPage >= monitorPageCount) setMonitorPage(monitorPageCount - 1);
  }, [monitorPage, monitorPageCount]);

  const isStatic = output === 'print';
  useEffect(() => {
    if (!preview || !isStatic) return;
    let cancelled = false;
    import('@lib/guest-menu/render').then(({ composeMenuHtml }) => {
      if (!cancelled) setStaticHtml(composeMenuHtml(preview.rendered));
    });
    return () => {
      cancelled = true;
    };
  }, [preview, isStatic]);

  const highlightCss = useMemo(() => {
    if (!selection) return '';
    const id = escapeAttr(selection.blockId);
    const selectors = [`[data-block-id="${id}"]`, `[data-section-id="${id}"]`, `[data-section-id^="${id}:"]`];
    const item = selection.itemId
      ? `[data-section-id="${id}"] [data-item-id="${escapeAttr(selection.itemId)}"], [data-section-id^="${id}:"] [data-item-id="${escapeAttr(selection.itemId)}"]`
      : '';
    return `.gm-builder-preview :is(${selectors.join(',')}){outline:2px dashed #3b82f6;outline-offset:4px;border-radius:4px}${
      item ? `.gm-builder-preview :is(${item}){outline:3px solid #3b82f6;outline-offset:2px}` : ''
    }`;
  }, [selection]);

  // Hover outline in select mode – also without a selection.
  const overlayCss = `${highlightCss}.gm-builder-preview[data-select-mode="true"] :is([data-block-id],[data-section-id],[data-item-id]):hover{outline:1px solid #3b82f680;outline-offset:2px;cursor:pointer}`;

  // Listener on the iframe document (capture phase), attached from the app.
  const onClickCapture = useCallback(
    (event: globalThis.MouseEvent) => {
      if (!selectMode) return;
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('.gm-shell-bar, .gm-shell-layer')) return;
      const itemElement = target.closest<HTMLElement>('[data-item-id]');
      const sectionElement = target.closest<HTMLElement>('[data-section-id]');
      const blockElement = target.closest<HTMLElement>('[data-block-id]');
      const blockId = sectionElement?.dataset.sectionId
        ? sectionIdToBlockId(sectionElement.dataset.sectionId, document)
        : (blockElement?.dataset.blockId ?? null);
      if (!blockId) return;
      event.preventDefault();
      event.stopPropagation();
      select({ blockId, itemId: itemElement?.dataset.itemId ?? null });
    },
    [selectMode, document, select],
  );

  const frame = (children: ReactNode, className: string) => (
    <IsolatedPreviewFrame
      title={t('builder.preview.frameTitle')}
      className={className}
      overlayCss={overlayCss}
      bodyClassName="gm-builder-preview"
      bodyAttributes={{ 'data-select-mode': selectMode ? 'true' : undefined }}
      onClickCapture={onClickCapture}
    >
      {children}
    </IsolatedPreviewFrame>
  );

  let content: ReactNode = null;
  if (preview) {
    if (output === 'web') {
      // The frame is the viewport: no `contained` mode (fixed overlays, media queries per device width).
      const shell = <GuestMenuShell key={`${preview.dto.locale}`} dto={preview.dto} rendered={preview.rendered} output="web" />;
      if (device === 'desktop') {
        content = frame(shell, 'h-full min-h-[600px] w-full rounded-lg border border-base-300 shadow-sm');
      } else {
        const size = DEVICE_SIZES[device];
        content = (
          <ScaledFrame width={size.width + 24} height={size.height + 24} available={available}>
            <div className="h-full w-full rounded-[2.2rem] bg-neutral p-3 shadow-xl">
              <div className="h-full w-full overflow-hidden rounded-[1.6rem] bg-base-100">{frame(shell, 'h-full w-full')}</div>
            </div>
          </ScaledFrame>
        );
      }
    } else if (output === 'monitor') {
      const portrait = previewMode === 'monitor-portrait';
      const width = portrait ? 1080 : 1920;
      const height = portrait ? 1920 : 1080;
      content = (
        <div className="flex flex-col gap-2">
          <ScaledFrame
            width={width}
            height={height}
            available={Math.min(available, portrait ? 520 : available)}
            className="overflow-hidden rounded-md bg-black shadow-xl"
          >
            {frame(
              <GuestMenuMonitorView
                dto={preview.dto}
                rendered={preview.rendered}
                format={portrait ? 'PORTRAIT' : 'LANDSCAPE'}
                pageIndex={monitorPage}
                onPageCount={setMonitorPageCount}
              />,
              'h-full w-full',
            )}
          </ScaledFrame>
          {monitorPageCount > 1 && (
            <div className="flex items-center justify-center gap-2 text-xs">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                shape="square"
                disabled={monitorPage <= 0}
                onClick={() => setMonitorPage((page) => Math.max(0, page - 1))}
                aria-label={t('builder.preview.previousPage')}
                title={t('builder.preview.previousPage')}
              >
                <FaChevronLeft />
              </Button>
              <span aria-live="polite">{t('builder.preview.page', { page: monitorPage + 1, total: monitorPageCount })}</span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                shape="square"
                disabled={monitorPage >= monitorPageCount - 1}
                onClick={() => setMonitorPage((page) => Math.min(monitorPageCount - 1, page + 1))}
                aria-label={t('builder.preview.nextPage')}
                title={t('builder.preview.nextPage')}
              >
                <FaChevronRight />
              </Button>
            </div>
          )}
        </div>
      );
    } else {
      const paper = PAPER_SIZES[document.outputs.print.paper];
      content = (
        <ScaledFrame width={paper.width} height={paper.height * 3} available={available} className="shadow-xl">
          {frame(
            <div
              style={{
                minHeight: '100%',
                width: '100%',
                background: '#ffffff',
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${paper.height - 1}px, #94a3b8 ${paper.height - 1}px, #94a3b8 ${paper.height}px)`,
              }}
            >
              <div className="gm-print-sheet" dangerouslySetInnerHTML={{ __html: staticHtml }} />
            </div>,
            'h-full w-full bg-white',
          )}
        </ScaledFrame>
      );
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end gap-2 px-3 pt-2 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={selectMode} onChange={(event) => setSelectMode(event.target.checked)} />
          <FaMousePointer /> {t('builder.preview.selectMode')}
        </label>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto p-3">
        {error && (
          <Alert variant="error" className="mb-3 text-sm">
            {error}
          </Alert>
        )}
        {preview && preview.rendered.errors.length + preview.rendered.cssErrors.length > 0 && (
          <Alert variant="warning" className="mb-3 text-xs">
            {t('builder.preview.renderErrors', { count: preview.rendered.errors.length + preview.rendered.cssErrors.length })}
          </Alert>
        )}
        <div className="h-full">
          {content ?? (
            <div className="flex h-64 items-center justify-center text-sm text-base-content/60">{loading ? <Spinner /> : t('builder.preview.empty')}</div>
          )}
        </div>
      </div>
      {loading && preview && (
        <div
          className="pointer-events-none absolute top-12 right-5 rounded-full bg-base-100 p-1.5 shadow"
          aria-live="polite"
          aria-label={t('builder.preview.loading')}
        >
          <Spinner />
        </div>
      )}
    </div>
  );
}
