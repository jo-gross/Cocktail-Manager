import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { cn } from '@components/ui';
import { GuestMenuSlideOptions, SignageBackgroundMode, SignageSlideType } from '@lib/signage/types';
import { IsolatedPreviewFrame } from '@components/guest-menu/IsolatedPreviewFrame';
import { GuestMenuSlide } from './GuestMenuSlide';

interface SignageDisplaySlide {
  id: string;
  content: string;
  type?: SignageSlideType;
  guestMenuId?: string | null;
  guestMenuSlug?: string | null;
  guestMenuAccessTokens?: string[];
  options?: GuestMenuSlideOptions | null;
}

interface SignageSlideDisplayProps {
  slides: SignageDisplaySlide[];
  slideDurationSeconds: number;
  backgroundMode?: SignageBackgroundMode;
  className?: string;
  emptyMessage?: string;
  alt?: string;
  /** Required to show GUEST_MENU slides (public menu endpoint accepts the workspace id as bar). */
  workspaceId?: string;
  /** Display format (virtual resolution of guest menu slides). */
  format?: 'LANDSCAPE' | 'PORTRAIT';
  /**
   * Render menu slides inside a sandboxed iframe (IsolatedPreviewFrame) so their
   * template/custom CSS cannot touch the surrounding document. Set by the admin
   * preview inside the logged-in app; the public /signage page renders directly.
   */
  isolateMenuSlides?: boolean;
}

const isMenuSlide = (slide: SignageDisplaySlide) => slide.type === 'GUEST_MENU';

/**
 * Rotates the slides. Image slides stay `slideDurationSeconds`; guest menu
 * slides stay until all their pages were shown (see GuestMenuSlide) and are
 * skipped while their menu cannot be shown.
 */
export function SignageSlideDisplay({
  slides,
  slideDurationSeconds,
  backgroundMode = 'COLOR',
  className,
  emptyMessage,
  alt,
  workspaceId,
  format = 'LANDSCAPE',
  isolateMenuSlides = false,
}: SignageSlideDisplayProps) {
  const { t } = useTranslation(['monitor', 'common']);
  const resolvedEmptyMessage = emptyMessage ?? t('monitor:noActiveSlide');
  const resolvedAlt = alt ?? t('common:monitorSlideAlt');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(new Set());
  const slidesKey = useMemo(() => slides.map((slide) => slide.id).join(','), [slides]);

  const visibleSlides = useMemo(
    () => slides.filter((slide) => !isMenuSlide(slide) || (workspaceId && !unavailableIds.has(slide.id))),
    [slides, unavailableIds, workspaceId],
  );
  const visibleCount = visibleSlides.length;
  const safeIndex = visibleCount > 0 ? currentIndex % visibleCount : 0;
  const currentSlide = visibleSlides[safeIndex];

  useEffect(() => {
    setCurrentIndex(0);
  }, [slidesKey, slideDurationSeconds]);

  const advance = useCallback(() => {
    if (visibleCount <= 1) return;
    setCurrentIndex((current) => ((current % visibleCount) + 1) % visibleCount);
  }, [visibleCount]);

  useEffect(() => {
    if (visibleCount <= 1 || !currentSlide || isMenuSlide(currentSlide)) {
      return;
    }

    const timeout = window.setTimeout(advance, slideDurationSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [advance, currentSlide, slideDurationSeconds, visibleCount]);

  const handleAvailabilityChange = useCallback((slideId: string, available: boolean) => {
    setUnavailableIds((current) => {
      if (available === !current.has(slideId)) return current;
      const next = new Set(current);
      if (available) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  }, []);

  const menuSlides = workspaceId ? slides.filter(isMenuSlide) : [];
  const imageSlides = visibleSlides.filter((slide) => !isMenuSlide(slide));

  return (
    <div className={cn('relative h-full w-full', className)}>
      {visibleCount === 0 ? <div className="flex h-full items-center justify-center text-sm text-base-content/70">{resolvedEmptyMessage}</div> : null}

      {backgroundMode === 'BLURRED' ? (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {imageSlides.map((slide) => (
            <div
              key={`blur-${slide.id}`}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
                slide.id === currentSlide?.id ? 'opacity-100' : 'opacity-0',
              )}
            >
              <Image src={slide.content} alt="" fill className="scale-110 object-cover blur-2xl" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 h-full w-full">
        {imageSlides.map((slide) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
              slide.id === currentSlide?.id ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={slide.id !== currentSlide?.id}
          >
            <div className="relative h-full w-full">
              <Image src={slide.content} alt={slide.id === currentSlide?.id ? resolvedAlt : ''} fill className="object-contain" />
            </div>
          </div>
        ))}
        {/* Menu slides stay mounted (also while unavailable) so they keep polling. */}
        {menuSlides.map((slide) => {
          const isCurrent = slide.id === currentSlide?.id;
          const menuSlide = (
            <GuestMenuSlide
              workspaceId={workspaceId!}
              slide={slide}
              format={format}
              active={isCurrent}
              fallbackPageDurationSeconds={slideDurationSeconds}
              onComplete={advance}
              onAvailabilityChange={handleAvailabilityChange}
            />
          );
          return (
            <div
              key={slide.id}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
                isCurrent ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              aria-hidden={!isCurrent}
            >
              {isolateMenuSlides ? (
                // Non-interactive preview: clicks fall through to the surrounding element.
                <IsolatedPreviewFrame title={resolvedAlt} className="pointer-events-none h-full w-full">
                  {menuSlide}
                </IsolatedPreviewFrame>
              ) : (
                menuSlide
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
