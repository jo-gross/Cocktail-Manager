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

export function SetupStepper({ steps, current, skipped = [], disabled = false, onSelect }: SetupStepperProps) {
  const { t } = useTranslation(['onboarding']);
  const currentIndex = steps.indexOf(current);

  return (
    <nav aria-label={t('onboarding:stepper.label')}>
      <ol className="flex w-full items-start gap-1 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = step === current;
          const isSkipped = skipped.includes(step) && !active;
          return (
            <li key={step} className="flex min-w-16 flex-1 flex-col items-center gap-1">
              <button
                type="button"
                disabled={disabled || active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onSelect(step)}
                className={cn(
                  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default',
                  active
                    ? 'border-primary bg-primary text-primary-content'
                    : done
                      ? 'border-primary text-primary hover:bg-primary/10'
                      : 'border-base-300 text-base-content/60 hover:bg-base-200',
                  isSkipped && 'border-dashed opacity-60',
                )}
              >
                {done && !isSkipped ? <FaCheck aria-hidden /> : index + 1}
                <span className="sr-only">{t(`onboarding:steps.${step}.title`)}</span>
              </button>
              <span aria-hidden className={cn('text-center text-xs', active ? 'font-semibold' : 'text-base-content/60')}>
                {t(`onboarding:steps.${step}.title`)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
