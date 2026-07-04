import React, { forwardRef } from 'react';
import { cn } from './cn';
import { cardBodyPadding, cardBodyPaddingCompact } from './layoutStyles';

export type CardVariant = 'surface' | 'elevated' | 'ghost' | 'inset';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Adds a subtle hover shadow transition for clickable cards. */
  interactive?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  surface: 'bg-base-200 shadow-lg',
  elevated: 'border border-base-300/60 bg-base-100 shadow-md',
  ghost: 'border border-base-300/60 bg-transparent shadow-none',
  inset: 'border-none bg-base-300/40 shadow-none',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ variant = 'surface', interactive = false, className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-2xl print:border print:shadow-none',
        variantClasses[variant],
        interactive && 'transition-shadow duration-200 hover:shadow-xl motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody({ compact = false, className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-2', compact ? cardBodyPaddingCompact : cardBodyPadding, className)} {...props}>
      {children}
    </div>
  );
});

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle({ className, children, ...props }, ref) {
  return (
    <h2 ref={ref} className={cn('flex items-center gap-2 text-xl font-semibold', className)} {...props}>
      {children}
    </h2>
  );
});

export type CardActionsProps = React.HTMLAttributes<HTMLDivElement>;

export const CardActions = forwardRef<HTMLDivElement, CardActionsProps>(function CardActions({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex flex-wrap items-center gap-2', className)} {...props}>
      {children}
    </div>
  );
});
