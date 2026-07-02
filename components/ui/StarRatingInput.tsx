import React, { useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { cn } from './cn';

export interface StarRatingInputProps {
  name?: string;
  value?: number;
  max?: number;
  onChange?: (event: { target: { name: string; value: number; type: string } }) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Star based rating input. Emits a synthetic change event compatible with
 * Formik's `handleChange` (`event.target.name` / `event.target.value`).
 */
export function StarRatingInput({ name = 'rating', value = 0, max = 5, onChange, disabled = false, className }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const emit = (next: number) => {
    onChange?.({ target: { name, value: next, type: 'number' } });
  };

  const display = hovered ?? value;

  return (
    <div className={cn('flex items-center gap-1', disabled && 'pointer-events-none opacity-60', className)} role="radiogroup" aria-label={name}>
      {Array.from({ length: max }, (_, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star}`}
          aria-pressed={value === star}
          disabled={disabled}
          className="cursor-pointer text-2xl text-warning transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => emit(star)}
        >
          {star <= display ? <FaStar /> : <FaRegStar />}
        </button>
      ))}
    </div>
  );
}
