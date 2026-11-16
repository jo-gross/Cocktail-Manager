import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { cn } from '@components/ui';
import type { SetupStep } from '@lib/onboarding/setupWizard';

interface SetupStepperProps {
  steps: readonly SetupStep[];
  current: SetupStep;
  /** Steps the business type skips by default (shown dimmed, still reachable). */
  skipped?: readonly SetupStep[];
  disabled?: boolean;
  onSelect: (step: SetupStep) => void;
}

/** Horizontal stepper (≥sm) / compact "Step 2 of 5" with a segmented progress bar (mobile). */
export function SetupStepper({ steps, current, skipped = [], disabled = false, onSelect }: SetupStepperProps) {
  const { t } = useTranslation(['onboarding']);
  const currentIndex = steps.indexOf(current);

  return (
    <nav aria-label={t('onboarding:stepper.label')}>
      <div className="flex flex-col gap-2 sm:hidden">
        <p className="text-sm font-medium text-base-content/70">{t('onboarding:stepper.progress', { current: currentIndex + 1, total: steps.length })}</p>
        <ol className="flex gap-1.5">
          {steps.map((step, index) => {
            const active = step === current;
            const isSkipped = skipped.includes(step) && !active;
            return (
              <li key={step} className="flex-1">
                <button
                  type="button"
                  disabled={disabled || active}
                  aria-current={active ? 'step' : undefined}
                  aria-label={t(`onboarding:steps.${step}.title`)}
                  onClick={() => onSelect(step)}
                  className="flex h-6 w-full cursor-pointer items-center rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-full rounded-full',
                      index <= currentIndex ? 'bg-primary' : 'bg-base-300',
                      isSkipped && index > currentIndex && 'opacity-50',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <ol className="hidden w-full sm:flex">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = step === current;
          const isSkipped = skipped.includes(step) && !active;
          return (
            <li key={step} className="relative flex flex-1 justify-center">
              {index > 0 ? (
                // Connector to the previous step: a separate segment that ends short of both circles (and their hover/focus
                // rings), so it never shows through a circle or a label.
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute top-[1.125rem] right-[calc(50%+1.125rem+0.5rem)] left-[calc(-50%+1.125rem+0.5rem)] h-0.5 -translate-y-1/2 rounded-full',
                    index <= currentIndex ? 'bg-primary' : 'bg-base-300',
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={disabled || active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(step)}
                className="group flex max-w-full cursor-pointer flex-col items-center gap-2 rounded-lg px-1 focus-visible:outline-none disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    'group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-base-100',
                    active
                      ? 'border-primary bg-primary text-primary-content'
                      : done
                        ? 'border-primary bg-base-100 text-primary group-hover:ring-4 group-hover:ring-primary/25'
                        : 'border-base-300 bg-base-100 text-base-content/60 group-hover:border-base-400 group-hover:text-base-content group-hover:ring-4 group-hover:ring-base-300/60',
                    isSkipped && 'border-dashed text-base-content/40',
                  )}
                >
                  {done && !isSkipped ? <FaCheck /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-center text-xs leading-tight underline-offset-2',
                    active ? 'font-semibold text-base-content' : 'text-base-content/60 group-hover:text-base-content group-hover:underline',
                    isSkipped && 'text-base-content/40',
                  )}
                >
                  {t(`onboarding:steps.${step}.title`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
