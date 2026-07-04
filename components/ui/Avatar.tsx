import React from 'react';
import { cn } from './cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  /** Fallback content (e.g. initials) shown when there is no image. */
  fallback?: React.ReactNode;
  size?: AvatarSize;
  rounded?: 'full' | 'lg';
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
};

export function Avatar({ src, alt = '', fallback, size = 'md', rounded = 'full', className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-base-300 font-medium text-base-content',
        rounded === 'full' ? 'rounded-full' : 'rounded-lg',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- generic avatar primitive, callers may pass any src */}
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : fallback}
    </div>
  );
}
