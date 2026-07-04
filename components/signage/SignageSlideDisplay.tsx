import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@components/ui';
import { SignageBackgroundMode } from '@lib/signage/types';

interface SignageSlideDisplayProps {
  slides: { id: string; content: string }[];
  slideDurationSeconds: number;
  backgroundMode?: SignageBackgroundMode;
  className?: string;
  emptyMessage?: string;
  alt?: string;
}

export function SignageSlideDisplay({
  slides,
  slideDurationSeconds,
  backgroundMode = 'COLOR',
  className,
  emptyMessage = 'No active slide',
  alt = 'Monitor slide',
}: SignageSlideDisplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesKey = useMemo(() => slides.map((slide) => slide.id).join(','), [slides]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [slidesKey, slideDurationSeconds]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % slides.length);
    }, slideDurationSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [slideDurationSeconds, slides.length]);

  if (slides.length === 0) {
    return <div className={cn('flex h-full items-center justify-center text-sm text-base-content/70', className)}>{emptyMessage}</div>;
  }

  return (
    <div className={cn('relative h-full w-full', className)}>
      {backgroundMode === 'BLURRED' ? (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {slides.map((slide, index) => (
            <div
              key={`blur-${slide.id}`}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
                index === currentIndex ? 'opacity-100' : 'opacity-0',
              )}
            >
              <Image src={slide.content} alt="" fill className="scale-110 object-cover blur-2xl" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 h-full w-full">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
              index === currentIndex ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={index !== currentIndex}
          >
            <div className="relative h-full w-full">
              <Image src={slide.content} alt={index === currentIndex ? alt : ''} fill className="object-contain" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
