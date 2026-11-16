import React, { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { FaTimes } from 'react-icons/fa';
import { Button, cn } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { getRunStep, getStepRoute, isOnRoute, resolveRoute, type TourRun } from '@lib/tours/engine';
import { tourEvents } from '@lib/tours/events';
import { computeCardPosition, isOutOfView, MOBILE_BREAKPOINT, sheetEdge, spotlightRect, type Rect, type Size } from '@lib/tours/placement';
import type { TourDefinition } from '@lib/tours/types';
import { findTourTarget, isEditableElement, prefersReducedMotion, roundedRectPath, waitForTourTarget } from './dom';

/** How long a step waits for its target before it is skipped. */
const TARGET_TIMEOUT_MS = 4000;
/** Keep measuring while the target settles (dropdown transitions, smooth scrolling). */
const SETTLE_MS = 1000;
const CARD_WIDTH = 352;

/** `keepFocus`: the step preparation moved the focus on purpose (e.g. opened a focus-within dropdown). */
type Phase = { kind: 'pending' } | { kind: 'shown'; target: HTMLElement | null; keepFocus: boolean } | { kind: 'paused' };

interface TourOverlayProps {
  tour: TourDefinition;
  run: TourRun;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onEnd: () => void;
  runPrepare: (id: string) => Promise<void>;
}

function useViewport(): Size {
  const [viewport, setViewport] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}

/** `<dialog id="globalModal">` while it is open (the rest of the DOM is inert then), else `document.body`. */
function usePortalContainer(): HTMLElement {
  const modalContext = useContext(ModalContext);
  const [container, setContainer] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
    const dialog = document.getElementById('globalModal') as HTMLDialogElement | null;
    const update = () => setContainer(dialog?.open ? dialog : document.body);
    update();
    if (!dialog) return;
    const observer = new MutationObserver(update);
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, [modalContext.content.length]);
  return container;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * Spotlight + step card of the running tour. Rendered via portal into the open modal dialog (or body) and shown as
 * `popover="manual"`, so it sits in the top layer above the dialog.
 */
export function TourOverlay({ tour, run, onNext, onBack, onSkip, onEnd, runPrepare }: TourOverlayProps) {
  const { t } = useTranslation('tours');
  const router = useRouter();
  const modalContext = useContext(ModalContext);
  const reduceMotion = useReducedMotion() ?? false;
  const viewport = useViewport();
  const container = usePortalContainer();
  const titleId = useId();
  const bodyId = useId();

  const step = getRunStep(tour, run);
  const stepKey = `${run.tourId}:${run.stepIndex}`;
  const path = router.asPath.split(/[?#]/)[0];

  const [phase, setPhase] = useState<Phase>({ kind: 'pending' });
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState<Size | null>(null);

  const routerRef = useRef(router);
  useLayoutEffect(() => {
    routerRef.current = router;
  }, [router]);
  const pushedForStep = useRef<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Step activation: navigate → prepare → wait for target (skip if it never appears) → show.
  useEffect(() => {
    if (!step) return;
    const controller = new AbortController();
    const asPath = routerRef.current.asPath;

    if (step.kind === 'action' && typeof step.advanceOn === 'object' && 'route' in step.advanceOn && isOnRoute(asPath, step.advanceOn.route, run.workspaceId)) {
      onNext();
      return;
    }

    const route = getStepRoute(tour, step.id);
    if (route && !isOnRoute(asPath, route, run.workspaceId)) {
      const resolved = resolveRoute(route, run.workspaceId);
      if (!resolved) {
        onSkip();
        return;
      }
      if (pushedForStep.current === stepKey) {
        // The user left the page of the step.
        setPhase({ kind: 'paused' });
        return;
      }
      pushedForStep.current = stepKey;
      setPhase({ kind: 'pending' });
      routerRef.current
        .push(resolved)
        .then((navigated) => {
          if (!navigated && !controller.signal.aborted) setPhase({ kind: 'paused' });
        })
        .catch(() => {
          if (!controller.signal.aborted) setPhase({ kind: 'paused' });
        });
      return () => controller.abort();
    }

    pushedForStep.current = stepKey;
    setPhase({ kind: 'pending' });
    void (async () => {
      const focusBefore = document.activeElement;
      if (step.prepare) await runPrepare(step.prepare).catch((error) => console.error('TourOverlay -> prepare', step.prepare, error));
      const keepFocus = document.activeElement !== focusBefore;
      if (controller.signal.aborted) return;
      const target = step.target ? await waitForTourTarget(step.target, TARGET_TIMEOUT_MS, controller.signal) : null;
      if (controller.signal.aborted) return;
      if (step.target && !target && step.kind !== 'info') {
        if (!step.optional) console.warn(`Tour "${tour.id}": target "${step.target}" of step "${step.id}" not found – step skipped`);
        onSkip();
        return;
      }
      if (target && isOutOfView(target.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      setPhase({ kind: 'shown', target, keepFocus });
    })();
    return () => controller.abort();
    // `path` re-runs the activation after navigations (own pushes, the user leaving or coming back).
  }, [stepKey, path, step, tour, run.workspaceId, onNext, onSkip, runPrepare]);

  // Track the target position.
  useLayoutEffect(() => {
    if (phase.kind !== 'shown' || !phase.target || !step?.target) {
      setTargetRect(null);
      return;
    }
    const targetId = step.target;
    let element = phase.target;
    const resizeObserver = new ResizeObserver(() => update());
    const update = () => {
      if (!element.isConnected) {
        const replacement = findTourTarget(targetId);
        if (!replacement) {
          setTargetRect(null);
          return;
        }
        element = replacement;
        resizeObserver.observe(element);
      }
      const rect = element.getBoundingClientRect();
      const next = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      setTargetRect((previous) => (sameRect(previous, next) ? previous : next));
    };
    resizeObserver.observe(element);
    resizeObserver.observe(document.documentElement);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const start = performance.now();
    let frame = 0;
    const settle = () => {
      update();
      if (performance.now() - start < SETTLE_MS) frame = requestAnimationFrame(settle);
    };
    settle();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [phase, step?.target]);

  // Action steps: advance on click / app event.
  useEffect(() => {
    if (phase.kind !== 'shown' || step?.kind !== 'action') return;
    const advanceOn = step.advanceOn;
    if (advanceOn === 'click') {
      const target = phase.target;
      if (!target) return;
      const onClick = (event: MouseEvent) => {
        if (event.target instanceof Node && target.contains(event.target)) {
          // Let the click do its work (open a modal, navigate) before the next step looks for its target.
          window.setTimeout(onNext, 0);
        }
      };
      document.addEventListener('click', onClick, true);
      return () => document.removeEventListener('click', onClick, true);
    }
    if ('event' in advanceOn) return tourEvents.on(advanceOn.event, onNext);
  }, [phase, step, onNext]);

  const canBack = run.visited.length > 0;
  const isLast = run.stepIndex >= run.stepIds.length - 1;
  const waitsForAction = step?.kind === 'action' && !step.optional;

  // Keyboard: Esc ends the tour before modals/overlays react, arrows navigate.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onEnd();
        return;
      }
      if (phase.kind !== 'shown' || isEditableElement(document.activeElement) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight' && !waitsForAction) {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft' && canBack) {
        event.preventDefault();
        onBack();
      }
    };
    // Esc / Android back on an open <dialog> fire `cancel` – GlobalModal would close the top modal.
    const onCancel = (event: Event) => {
      // File inputs fire `cancel` too.
      if (!(event.target instanceof HTMLDialogElement)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onEnd();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('cancel', onCancel, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('cancel', onCancel, true);
    };
  }, [phase.kind, waitsForAction, canBack, onNext, onBack, onEnd]);

  // Top layer: (re-)show the popover whenever it is mounted into a new container / the modal stack changed.
  useLayoutEffect(() => {
    const element = popoverRef.current;
    try {
      element?.showPopover();
    } catch {
      // Already shown or popover API unavailable – the fixed overlay still renders.
    }
    return () => {
      try {
        element?.hidePopover();
      } catch {
        // ignore
      }
    };
  }, [container, modalContext.content.length]);

  // Measure the card for placement.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) {
      setCardSize(null);
      return;
    }
    const measure = () =>
      setCardSize((previous) =>
        previous?.width === element.offsetWidth && previous?.height === element.offsetHeight
          ? previous
          : { width: element.offsetWidth, height: element.offsetHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase.kind, stepKey]);

  // Focus: the card takes focus for each step, unless a preparation opened something that lives on focus (dropdowns).
  const restoreFocus = useRef<Element | null>(null);
  useEffect(() => {
    restoreFocus.current = document.activeElement;
    return () => {
      const element = restoreFocus.current as HTMLElement | null;
      if (element?.isConnected) element.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (phase.kind === 'pending' || (phase.kind === 'shown' && phase.keepFocus)) return;
    cardRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const resume = useCallback(() => {
    pushedForStep.current = null;
    const route = step ? getStepRoute(tour, step.id) : undefined;
    const resolved = route ? resolveRoute(route, run.workspaceId) : null;
    if (resolved) void routerRef.current.push(resolved);
  }, [run.workspaceId, step, tour]);

  if (!step) return null;

  const isMobile = viewport.width < MOBILE_BREAKPOINT;
  const spotlight = phase.kind === 'shown' && targetRect ? spotlightRect(targetRect, viewport) : null;
  const holeClickable = step.kind === 'action';

  let cardStyle: React.CSSProperties;
  let sheetAtTop = false;
  if (isMobile) {
    sheetAtTop = sheetEdge(spotlight, cardSize?.height ?? 0, viewport) === 'top';
    cardStyle = sheetAtTop ? { top: 0, left: 0, right: 0 } : { bottom: 0, left: 0, right: 0 };
  } else if (spotlight && cardSize) {
    const position = computeCardPosition(spotlight, cardSize, viewport, step.kind === 'info' ? 'auto' : (step.placement ?? 'auto'));
    cardStyle = { top: position.top, left: position.left, width: CARD_WIDTH };
  } else if (cardSize) {
    cardStyle = { top: (viewport.height - cardSize.height) / 2, left: (viewport.width - cardSize.width) / 2, width: CARD_WIDTH };
  } else {
    cardStyle = { top: 0, left: 0, width: CARD_WIDTH, visibility: 'hidden' };
  }

  const stopPointer = (event: React.SyntheticEvent) => {
    // Keep focus where it is (focus-within dropdowns) and swallow the click.
    event.preventDefault();
    event.stopPropagation();
  };

  const overlayPath =
    `M0 0H${viewport.width}V${viewport.height}H0Z` +
    (spotlight ? ' ' + roundedRectPath(spotlight.left, spotlight.top, spotlight.width, spotlight.height, 10) : '');

  const content =
    phase.kind === 'pending' ? null : phase.kind === 'paused' ? (
      <>
        <svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
          <path d={overlayPath} fill="rgb(0 0 0 / 0.45)" className="pointer-events-auto" onMouseDown={stopPointer} onClick={stopPointer} />
        </svg>
        <TourCard
          ref={cardRef}
          isMobile={isMobile}
          sheetAtTop={sheetAtTop}
          style={cardStyle}
          reduceMotion={reduceMotion}
          titleId={titleId}
          bodyId={bodyId}
          title={t('engine.paused.title')}
          body={t('engine.paused.body')}
          progress={t('engine.progress', { current: run.stepIndex + 1, total: run.stepIds.length })}
          closeLabel={t('engine.end')}
          onClose={onEnd}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={onEnd}>
                {t('engine.end')}
              </Button>
              <Button variant="primary" size="sm" onClick={resume}>
                {t('engine.resume')}
              </Button>
            </>
          }
        />
      </>
    ) : (
      <>
        <svg className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
          <path
            d={overlayPath}
            fillRule="evenodd"
            fill="rgb(0 0 0 / 0.55)"
            className="pointer-events-auto"
            style={reduceMotion ? undefined : { transition: 'd 200ms ease-out' }}
            onMouseDown={stopPointer}
            onClick={stopPointer}
          />
          {spotlight && (
            <path
              d={roundedRectPath(spotlight.left, spotlight.top, spotlight.width, spotlight.height, 10)}
              fill="transparent"
              stroke="var(--color-primary)"
              strokeWidth={2}
              className={holeClickable ? 'pointer-events-none' : 'pointer-events-auto'}
              style={reduceMotion ? undefined : { transition: 'd 200ms ease-out' }}
              onMouseDown={holeClickable ? undefined : stopPointer}
              onClick={holeClickable ? undefined : stopPointer}
            />
          )}
        </svg>
        <TourCard
          key={stepKey}
          ref={cardRef}
          isMobile={isMobile}
          sheetAtTop={sheetAtTop}
          style={cardStyle}
          reduceMotion={reduceMotion}
          titleId={titleId}
          bodyId={bodyId}
          title={t(step.title)}
          body={t(step.body)}
          hint={step.kind === 'action' ? t('engine.actionHint') : undefined}
          progress={t('engine.progress', { current: run.stepIndex + 1, total: run.stepIds.length })}
          closeLabel={t('engine.end')}
          onClose={onEnd}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={onBack} disabled={!canBack}>
                {t('engine.back')}
              </Button>
              {step.kind === 'action' ? (
                step.optional && (
                  <Button variant="outline" size="sm" onClick={onNext}>
                    {isLast ? t('engine.done') : t('engine.skip')}
                  </Button>
                )
              ) : (
                <Button variant="primary" size="sm" onClick={onNext}>
                  {isLast ? t('engine.done') : t('engine.next')}
                </Button>
              )}
            </>
          }
        />
      </>
    );

  return createPortal(
    <div
      key={`${container === document.body ? 'body' : 'dialog'}-${modalContext.content.length}`}
      ref={popoverRef}
      popover="manual"
      data-tour-overlay=""
      className="pointer-events-none fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-visible border-0 bg-transparent p-0 text-base-content print:hidden"
    >
      {content}
    </div>,
    container,
  );
}

interface TourCardProps {
  isMobile: boolean;
  sheetAtTop: boolean;
  style: React.CSSProperties;
  reduceMotion: boolean;
  titleId: string;
  bodyId: string;
  title: string;
  body: string;
  hint?: string;
  progress: string;
  closeLabel: string;
  onClose: () => void;
  footer: React.ReactNode;
}

const TourCard = React.forwardRef<HTMLDivElement, TourCardProps>(function TourCard(props, ref) {
  const offset = props.isMobile ? (props.sheetAtTop ? -24 : 24) : 6;
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={props.titleId}
      aria-describedby={props.bodyId}
      tabIndex={-1}
      style={props.style}
      initial={props.reduceMotion ? { opacity: 0 } : { opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: props.reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={cn(
        'pointer-events-auto fixed flex flex-col gap-3 border border-base-300 bg-base-100 p-4 shadow-xl outline-none',
        props.isMobile
          ? cn(
              'max-h-[60dvh] overflow-y-auto',
              props.sheetAtTop ? 'rounded-b-2xl pt-[max(1rem,env(safe-area-inset-top))]' : 'rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]',
            )
          : 'max-w-[calc(100vw-1rem)] rounded-2xl',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-base-content/60" aria-live="polite">
          {props.progress}
        </span>
        <Button variant="ghost" shape="circle" size="xs" aria-label={props.closeLabel} onClick={props.onClose}>
          <FaTimes aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <h2 id={props.titleId} className="text-lg font-bold">
          {props.title}
        </h2>
        <p id={props.bodyId} className="text-sm whitespace-pre-line text-base-content/80">
          {props.body}
        </p>
        {props.hint && <p className="text-xs text-primary">{props.hint}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">{props.footer}</div>
    </motion.div>
  );
});
