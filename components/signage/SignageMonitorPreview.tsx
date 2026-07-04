import { useContext, useMemo } from 'react';
import { cn } from '@components/ui';
import { SignageFormatView } from '@lib/signage/types';
import { filterSlidesForDisplay } from '@lib/signage/isSlideActiveNow';
import { resolveSignageSlides } from '@lib/signage/signageApiHelpers';
import { getSignageContainerClassName, getSignageContainerStyle } from '@lib/signage/signageBackground';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { SignageSlideDisplay } from './SignageSlideDisplay';

interface SignageMonitorPreviewProps {
  format: SignageFormatView;
  allFormats?: SignageFormatView[];
  variant?: 'inline' | 'modal';
}

function SignageMonitorPreviewContent({ format, allFormats, variant }: SignageMonitorPreviewProps) {
  const displaySlides = useMemo(() => {
    if (allFormats && allFormats.length > 0) {
      return resolveSignageSlides(allFormats, format.format);
    }
    return format.slides;
  }, [allFormats, format.format, format.slides]);

  const slides = filterSlidesForDisplay(displaySlides);
  const isPortrait = format.format === 'PORTRAIT';
  const backgroundMode = format.backgroundMode ?? 'COLOR';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-base-300',
        getSignageContainerClassName(backgroundMode, format.backgroundColor),
        variant === 'modal'
          ? isPortrait
            ? 'mx-auto aspect-9/16 h-[80vh] w-auto'
            : 'mx-auto aspect-video w-[min(90vw,64rem)]'
          : isPortrait
            ? 'mx-auto aspect-9/16 h-96 w-auto'
            : 'aspect-video w-full',
      )}
      style={getSignageContainerStyle(backgroundMode, format.backgroundColor)}
    >
      <SignageSlideDisplay
        slides={slides}
        slideDurationSeconds={format.slideDurationSeconds}
        backgroundMode={backgroundMode}
        emptyMessage="Keine aktive Karte für jetzt"
        alt="Monitor preview slide"
      />
    </div>
  );
}

export function SignageMonitorPreview({ format, allFormats, variant = 'inline' }: SignageMonitorPreviewProps) {
  const modalContext = useContext(ModalContext);

  if (variant === 'modal') {
    return <SignageMonitorPreviewContent format={format} allFormats={allFormats} variant="modal" />;
  }

  return (
    <button
      type="button"
      className="block w-full cursor-zoom-in text-left"
      onClick={() => modalContext.openModal(<SignageMonitorPreviewContent format={format} allFormats={allFormats} variant="modal" />)}
      title="Monitor-Vorschau vergrößern"
    >
      <SignageMonitorPreviewContent format={format} allFormats={allFormats} variant="inline" />
    </button>
  );
}
