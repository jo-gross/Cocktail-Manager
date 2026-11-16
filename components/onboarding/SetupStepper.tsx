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
            <li
              key={step}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-2',
                // Connector to the previous step, drawn behind the circles.
                index > 0 && 'before:absolute before:top-[1.125rem] before:right-1/2 before:-left-1/2 before:h-0.5 before:-translate-y-1/2',
                index > 0 && (index <= currentIndex ? 'before:bg-primary' : 'before:bg-base-300'),
              )}
            >
              <button
                type="button"
                disabled={disabled || active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(step)}
                className={cn(
                  'relative z-[1] flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 bg-base-100 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 focus-visible:outline-none disabled:cursor-default',
                  active
                    ? 'border-primary bg-primary text-primary-content'
                    : done
                      ? 'border-primary text-primary hover:bg-primary/10'
                      : 'border-base-300 text-base-content/60 hover:bg-base-200',
                  isSkipped && 'border-dashed text-base-content/40',
                )}
              >
                {done && !isSkipped ? <FaCheck aria-hidden /> : index + 1}
                <span className="sr-only">{t(`onboarding:steps.${step}.title`)}</span>
              </button>
              <span
                aria-hidden
                className={cn(
                  'px-1 text-center text-xs leading-tight',
                  active ? 'font-semibold text-base-content' : 'text-base-content/60',
                  isSkipped && 'text-base-content/40',
                )}
              >
                {t(`onboarding:steps.${step}.title`)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
